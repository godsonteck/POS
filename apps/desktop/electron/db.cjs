const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createDatabase(userDataPath) {
  const filename = path.join(userDataPath, 'pos.sqlite');
  const schemaPath = path.join(__dirname, '../../../packages/core/src/schema.sql');
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  const now = new Date().toISOString();

  if (!db.prepare('SELECT id FROM shop_config LIMIT 1').get()) {
    db.prepare(`INSERT INTO shop_config (id,type,name,currency,created_at,updated_at) VALUES (?,?,?,?,?,?)`).run('shop-a','cosmetics-provisions','Cosmetics & Provisions','GHS',now,now);
  }
  if (!db.prepare('SELECT id FROM users WHERE username=?').get('owner')) {
    const salt=crypto.randomBytes(16).toString('hex');
    const hash=crypto.scryptSync('1234',salt,64).toString('hex');
    db.prepare(`INSERT INTO users (id,name,username,pin_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).run('owner-1','Owner','owner',`${salt}:${hash}`,'owner',now,now);
  }

  const seedCategories=[['cat-hair','Hair Care'],['cat-skin','Skin Care'],['cat-provisions','Provisions'],['cat-personal','Personal Care'],['cat-snacks','Snacks']];
  const insertCategory=db.prepare(`INSERT OR IGNORE INTO categories (id,name,created_at,updated_at) VALUES (?,?,?,?)`);
  for(const [id,name] of seedCategories) insertCategory.run(id,name,now,now);
  if(Number(db.prepare('SELECT COUNT(*) AS count FROM products').get().count)===0){
    const products=[
      ['p-cantu','Cantu Shea Butter Cream','817513010124','cat-hair',5500,12,5],
      ['p-vaseline','Vaseline Cocoa Radiant','8712561267075','cat-skin',3800,24,5],
      ['p-nivea','Nivea Soft Moisturiser','4005900380742','cat-skin',4200,7,5],
      ['p-milo','Milo 400g','7613032230700','cat-provisions',3200,31,5],
      ['p-milk','Ideal Milk 160g','8716200220134','cat-provisions',850,4,5],
      ['p-closeup','Closeup Toothpaste 120ml','8717163705632','cat-personal',2100,9,5],
      ['p-biscuits','Ghana Mixed Biscuits','000000000007','cat-snacks',1200,18,5],
      ['p-soap','Imperial Leather Soap','5000108024680','cat-personal',1400,3,5],
    ];
    const insert=db.prepare(`INSERT INTO products (id,name,barcode,category_id,price_pesewas,quantity_in_stock,low_stock_threshold,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
    const seed=db.transaction(()=>{for(const p of products)insert.run(...p,now,now)});seed();
  }
  return db;
}

function verifyPin(db,username,pin){
  const user=db.prepare('SELECT id,name,username,pin_hash,role,active FROM users WHERE username=? AND active=1').get(username);
  if(!user)return null;
  const [salt,expected]=user.pin_hash.split(':');
  const actual=crypto.scryptSync(pin,salt,64).toString('hex');
  if(!expected||!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex')))return null;
  return {id:user.id,name:user.name,username:user.username,role:user.role};
}
function listProducts(db){return db.prepare(`SELECT p.id,p.name,p.barcode,p.price_pesewas AS pricePesewas,p.quantity_in_stock AS quantityInStock,p.low_stock_threshold AS lowStockThreshold,p.active,c.id AS categoryId,c.name AS category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 ORDER BY p.name COLLATE NOCASE`).all()}
function listCategories(db){return db.prepare('SELECT id,name FROM categories WHERE active=1 ORDER BY name COLLATE NOCASE').all()}
function nextReceiptNumber(db){const day=new Date().toISOString().slice(0,10).replaceAll('-','');const row=db.prepare(`SELECT COUNT(*) AS count FROM sales WHERE created_at>=?`).get(`${new Date().toISOString().slice(0,10)}T00:00:00.000Z`);return `A-${day}-${String(Number(row.count)+1).padStart(4,'0')}`}
function checkout(db,input){
  const now=new Date().toISOString();const saleId=crypto.randomUUID();const receiptNumber=nextReceiptNumber(db);
  if(!input.items?.length)throw new Error('Cart is empty');if(!input.staffId)throw new Error('A signed-in cashier is required');
  if(input.items.some(x=>!Number.isSafeInteger(Number(x.quantity))||Number(x.quantity)<=0))throw new Error('Invalid quantity');
  if(new Set(input.items.map(x=>x.productId)).size!==input.items.length)throw new Error('Duplicate products are not allowed');
  if(input.paymentMethod==='momo'&&!String(input.momoReference||'').trim())throw new Error('Mobile Money reference is required');
  return db.transaction(()=>{
    const rows=input.items.map(item=>db.prepare(`SELECT id,name,price_pesewas,quantity_in_stock FROM products WHERE id=? AND active=1`).get(item.productId));
    if(rows.some(p=>!p))throw new Error('One or more products no longer exist');
    const total=input.items.reduce((sum,item,i)=>sum+Number(item.quantity)*Number(rows[i].price_pesewas),0);
    const tendered=input.paymentMethod==='cash'?Number(input.amountTenderedPesewas||0):total;
    if(!Number.isSafeInteger(tendered)||tendered<total)throw new Error('Insufficient payment');const change=tendered-total;
    db.prepare(`INSERT INTO sales (id,receipt_number,staff_id,total_pesewas,status,created_at) VALUES (?,?,?,?, 'completed',?)`).run(saleId,receiptNumber,input.staffId,total,now);
    for(const[i,item]of input.items.entries()){const product=rows[i];if(product.quantity_in_stock<item.quantity)throw new Error(`Insufficient stock: ${product.name}`);db.prepare(`INSERT INTO sale_items (id,sale_id,product_id,quantity,unit_price_pesewas,line_total_pesewas) VALUES (lower(hex(randomblob(16))),?,?,?,?,?)`).run(saleId,product.id,item.quantity,product.price_pesewas,item.quantity*product.price_pesewas);db.prepare('UPDATE products SET quantity_in_stock=quantity_in_stock-?,updated_at=? WHERE id=?').run(item.quantity,now,product.id);db.prepare(`INSERT INTO stock_movements (id,product_id,quantity_delta,reason,reference_id,created_by,created_at) VALUES (lower(hex(randomblob(16))),?,?,'sale',?,?,?)`).run(product.id,-item.quantity,saleId,input.staffId,now)}
    db.prepare(`INSERT INTO payments (id,sale_id,method,amount_pesewas,amount_tendered_pesewas,change_pesewas,momo_reference,created_at) VALUES (lower(hex(randomblob(16))),?,?,?,?,?,?,?)`).run(saleId,input.paymentMethod,total,tendered,change,input.momoReference?.trim()||null,now);
    db.prepare(`INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (lower(hex(randomblob(16))),?,'sale.completed','sale',?,?,?)`).run(input.staffId,saleId,JSON.stringify({receiptNumber,total,paymentMethod:input.paymentMethod}),now);
    db.prepare(`INSERT INTO sync_outbox (id,entity_type,entity_id,operation,payload_json,created_at) VALUES (lower(hex(randomblob(16))),'sale',?,'upsert',?,?,?)`).run(saleId,JSON.stringify({saleId,receiptNumber}),now);
    return {saleId,receiptNumber,totalPesewas:total,changePesewas:change};
  })();
}
module.exports={createDatabase,verifyPin,listProducts,listCategories,checkout};
