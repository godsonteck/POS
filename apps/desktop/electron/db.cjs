const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function now() { return new Date().toISOString(); }
function id() { return crypto.randomUUID(); }
function requireActor(db, actorId, ownerOnly = false) {
  const user = db.prepare('SELECT id, role, active FROM users WHERE id=?').get(actorId);
  if (!user || !user.active) throw new Error('Authorized user required');
  if (ownerOnly && user.role !== 'owner') throw new Error('Owner permission required');
  return user;
}

function createDatabase(userDataPath) {
  const filename = path.join(userDataPath, 'pos.sqlite');
  const schemaPath = path.join(__dirname, '../../../packages/core/src/schema.sql');
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  const timestamp = now();
  if (!db.prepare('SELECT id FROM shop_config LIMIT 1').get()) {
    db.prepare('INSERT INTO shop_config (id,type,name,currency,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('shop-a','cosmetics-provisions','Cosmetics & Provisions','GHS',timestamp,timestamp);
  }
  if (!db.prepare('SELECT id FROM users WHERE username=?').get('owner')) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('1234', salt, 64).toString('hex');
    db.prepare('INSERT INTO users (id,name,username,pin_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('owner-1','Owner','owner',`${salt}:${hash}`,'owner',timestamp,timestamp);
  }
  const categories = [['cat-hair','Hair Care'],['cat-skin','Skin Care'],['cat-provisions','Provisions'],['cat-personal','Personal Care'],['cat-snacks','Snacks']];
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id,name,created_at,updated_at) VALUES (?,?,?,?)');
  for (const [categoryId,name] of categories) insertCategory.run(categoryId,name,timestamp,timestamp);
  if (Number(db.prepare('SELECT COUNT(*) AS count FROM products').get().count) === 0) {
    const products = [['p-cantu','Cantu Shea Butter Cream','817513010124','cat-hair',5500,12,5],['p-vaseline','Vaseline Cocoa Radiant','8712561267075','cat-skin',3800,24,5],['p-nivea','Nivea Soft Moisturiser','4005900380742','cat-skin',4200,7,5],['p-milo','Milo 400g','7613032230700','cat-provisions',3200,31,5],['p-milk','Ideal Milk 160g','8716200220134','cat-provisions',850,4,5],['p-closeup','Closeup Toothpaste 120ml','8717163705632','cat-personal',2100,9,5],['p-biscuits','Ghana Mixed Biscuits','000000000007','cat-snacks',1200,18,5],['p-soap','Imperial Leather Soap','5000108024680','cat-personal',1400,3,5]];
    const insert = db.prepare('INSERT INTO products (id,name,barcode,category_id,price_pesewas,quantity_in_stock,low_stock_threshold,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
    db.transaction(() => { for (const product of products) insert.run(...product,timestamp,timestamp); })();
  }
  return db;
}

function verifyPin(db, username, pin) {
  const user = db.prepare('SELECT id,name,username,pin_hash,role,active FROM users WHERE username=? AND active=1').get(username);
  if (!user) return null;
  const [salt, expected] = user.pin_hash.split(':');
  if (!salt || !expected) return null;
  const actual = crypto.scryptSync(pin, salt, 64).toString('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(actual,'hex'))) return null;
  return { id:user.id, name:user.name, username:user.username, role:user.role };
}

function listProducts(db) {
  return db.prepare('SELECT p.id,p.name,p.barcode,p.price_pesewas AS pricePesewas,p.quantity_in_stock AS quantityInStock,p.low_stock_threshold AS lowStockThreshold,p.active,c.id AS categoryId,c.name AS category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 ORDER BY p.name COLLATE NOCASE').all();
}
function listCategories(db) { return db.prepare('SELECT id,name FROM categories WHERE active=1 ORDER BY name COLLATE NOCASE').all(); }
function listLowStock(db) { return db.prepare('SELECT p.id,p.name,p.barcode,p.quantity_in_stock AS quantityInStock,p.low_stock_threshold AS lowStockThreshold,c.name AS category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 AND p.quantity_in_stock<=p.low_stock_threshold ORDER BY p.quantity_in_stock ASC,p.name COLLATE NOCASE').all(); }

function nextReceiptNumber(db) {
  const day = new Date().toISOString().slice(0,10).replaceAll('-','');
  const prefix = `${day}T00:00:00.000Z`;
  const count = Number(db.prepare('SELECT COUNT(*) AS count FROM sales WHERE created_at>=?').get(prefix).count);
  return `A-${day}-${String(count+1).padStart(4,'0')}`;
}

function checkout(db,input) {
  const timestamp=now(); const saleId=id(); const receiptNumber=nextReceiptNumber(db);
  if (!input.items?.length) throw new Error('Cart is empty');
  requireActor(db,String(input.staffId||''));
  if (input.items.some(x=>!Number.isSafeInteger(Number(x.quantity))||Number(x.quantity)<=0)) throw new Error('Invalid quantity');
  if (new Set(input.items.map(x=>x.productId)).size!==input.items.length) throw new Error('Duplicate products are not allowed');
  if (!['cash','momo'].includes(input.paymentMethod)) throw new Error('Invalid payment method');
  if (input.paymentMethod==='momo'&&!String(input.momoReference||'').trim()) throw new Error('Mobile Money reference is required');
  return db.transaction(()=>{
    const rows=input.items.map(item=>db.prepare('SELECT id,name,price_pesewas,quantity_in_stock FROM products WHERE id=? AND active=1').get(item.productId));
    if(rows.some(p=>!p)) throw new Error('One or more products no longer exist');
    const total=input.items.reduce((sum,item,i)=>sum+Number(item.quantity)*Number(rows[i].price_pesewas),0);
    const tendered=input.paymentMethod==='cash'?Number(input.amountTenderedPesewas||0):total;
    if(!Number.isSafeInteger(tendered)||tendered<total) throw new Error('Insufficient payment');
    const change=tendered-total;
    db.prepare("INSERT INTO sales (id,receipt_number,staff_id,total_pesewas,status,created_at) VALUES (?,?,?,?, 'completed',?)").run(saleId,receiptNumber,input.staffId,total,timestamp);
    for(const [i,item] of input.items.entries()) {
      const product=rows[i];
      if(product.quantity_in_stock<Number(item.quantity)) throw new Error(`Insufficient stock: ${product.name}`);
      db.prepare('INSERT INTO sale_items (id,sale_id,product_id,quantity,unit_price_pesewas,line_total_pesewas) VALUES (?,?,?,?,?,?)').run(id(),saleId,product.id,Number(item.quantity),product.price_pesewas,Number(item.quantity)*product.price_pesewas);
      db.prepare('UPDATE products SET quantity_in_stock=quantity_in_stock-?,updated_at=? WHERE id=? AND quantity_in_stock>=?').run(Number(item.quantity),timestamp,product.id,Number(item.quantity));
      db.prepare("INSERT INTO stock_movements (id,product_id,quantity_delta,reason,reference_id,created_by,created_at) VALUES (?,?,?,?,?,?,?)").run(id(),product.id,-Number(item.quantity),'sale',saleId,input.staffId,timestamp);
    }
    db.prepare('INSERT INTO payments (id,sale_id,method,amount_pesewas,amount_tendered_pesewas,change_pesewas,momo_reference,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id(),saleId,input.paymentMethod,total,tendered,change,String(input.momoReference||'').trim()||null,timestamp);
    db.prepare('INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)').run(id(),input.staffId,'sale.completed','sale',saleId,JSON.stringify({receiptNumber,total,paymentMethod:input.paymentMethod}),timestamp);
    db.prepare('INSERT INTO sync_outbox (id,entity_type,entity_id,operation,payload_json,created_at) VALUES (?,?,?,?,?,?)').run(id(),'sale',saleId,'upsert',JSON.stringify({saleId,receiptNumber}),timestamp);
    return {saleId,receiptNumber,totalPesewas:total,changePesewas:change};
  })();
}

function listSales(db, filters={}) {
  const clauses=[]; const params={};
  if(filters.from){clauses.push('s.created_at>=@from');params.from=filters.from;}
  if(filters.to){clauses.push('s.created_at<=@to');params.to=filters.to;}
  if(filters.staffId){clauses.push('s.staff_id=@staffId');params.staffId=filters.staffId;}
  const where=clauses.length?`WHERE ${clauses.join(' AND ')}`:'';
  return db.prepare(`SELECT s.id,s.receipt_number AS receiptNumber,s.total_pesewas AS totalPesewas,s.status,s.created_at AS createdAt,u.id AS staffId,u.name AS staffName,p.method AS paymentMethod FROM sales s JOIN users u ON u.id=s.staff_id LEFT JOIN payments p ON p.sale_id=s.id ${where} ORDER BY s.created_at DESC LIMIT 500`).all(params);
}
function getSale(db,saleId) {
  const sale=db.prepare('SELECT s.id,s.receipt_number AS receiptNumber,s.total_pesewas AS totalPesewas,s.status,s.created_at AS createdAt,u.id AS staffId,u.name AS staffName,p.method AS paymentMethod,p.amount_pesewas AS amountPesewas,p.amount_tendered_pesewas AS amountTenderedPesewas,p.change_pesewas AS changePesewas,p.momo_reference AS momoReference FROM sales s JOIN users u ON u.id=s.staff_id LEFT JOIN payments p ON p.sale_id=s.id WHERE s.id=?').get(saleId);
  if(!sale)return null;
  sale.items=db.prepare('SELECT si.product_id AS productId,pr.name,si.quantity,si.unit_price_pesewas AS unitPricePesewas,si.line_total_pesewas AS lineTotalPesewas FROM sale_items si JOIN products pr ON pr.id=si.product_id WHERE si.sale_id=?').all(saleId);
  return sale;
}
function createProduct(db,input,actorId) {
  requireActor(db,actorId,true);
  const name=String(input.name||'').trim(); const price=Number(input.pricePesewas); const stock=Number(input.quantityInStock||0); const threshold=Number(input.lowStockThreshold??5); const barcode=String(input.barcode||'').trim()||null;
  if(!name)throw new Error('Product name is required'); if(!Number.isSafeInteger(price)||price<0)throw new Error('Invalid price'); if(!Number.isSafeInteger(stock)||stock<0)throw new Error('Invalid stock'); if(!Number.isSafeInteger(threshold)||threshold<0)throw new Error('Invalid low-stock threshold');
  if(barcode&&db.prepare('SELECT id FROM products WHERE barcode=?').get(barcode))throw new Error('Barcode already exists');
  const productId=id(),timestamp=now();
  db.transaction(()=>{db.prepare('INSERT INTO products (id,name,barcode,category_id,price_pesewas,quantity_in_stock,low_stock_threshold,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(productId,name,barcode,input.categoryId||null,price,stock,threshold,timestamp,timestamp);if(stock)db.prepare('INSERT INTO stock_movements (id,product_id,quantity_delta,reason,created_by,created_at) VALUES (?,?,?,?,?,?)').run(id(),productId,stock,'initial-stock',actorId,timestamp);db.prepare('INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)').run(id(),actorId,'product.created','product',productId,JSON.stringify({name,barcode,price}),timestamp);})();
  return db.prepare('SELECT id,name,barcode,price_pesewas AS pricePesewas,quantity_in_stock AS quantityInStock,low_stock_threshold AS lowStockThreshold,category_id AS categoryId FROM products WHERE id=?').get(productId);
}
function adjustStock(db,input,actorId) {
  requireActor(db,actorId,true); const productId=String(input.productId||''); const delta=Number(input.quantityDelta); const reason=String(input.reason||'adjustment').trim();
  if(!productId||!Number.isSafeInteger(delta)||delta===0)throw new Error('Invalid stock adjustment');
  const timestamp=now();
  return db.transaction(()=>{const product=db.prepare('SELECT id,name,quantity_in_stock FROM products WHERE id=? AND active=1').get(productId);if(!product)throw new Error('Product not found');const next=product.quantity_in_stock+delta;if(next<0)throw new Error('Stock cannot become negative');db.prepare('UPDATE products SET quantity_in_stock=?,updated_at=? WHERE id=?').run(next,timestamp,productId);db.prepare('INSERT INTO stock_movements (id,product_id,quantity_delta,reason,created_by,created_at) VALUES (?,?,?,?,?,?)').run(id(),productId,delta,reason,actorId,timestamp);db.prepare('INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)').run(id(),actorId,'stock.adjusted','product',productId,JSON.stringify({delta,reason,before:product.quantity_in_stock,after:next}),timestamp);db.prepare('INSERT INTO sync_outbox (id,entity_type,entity_id,operation,payload_json,created_at) VALUES (?,?,?,?,?,?)').run(id(),'product',productId,'upsert',JSON.stringify({productId,quantityInStock:next}),timestamp);return {productId,quantityInStock:next};})();
}

module.exports={createDatabase,verifyPin,listProducts,listCategories,listLowStock,checkout,listSales,getSale,createProduct,adjustStock};
