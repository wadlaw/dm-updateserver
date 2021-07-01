const { getSalesData, formatDateString } = require('./goodtill');
const sqlite = require('sqlite3');
require('dotenv').config();
// Will open and connect to database if it exists,
// - if it doesn't, it will be created and connected to
const db = new sqlite.Database('../database/db.sqlite');

function createSalesTable(tableName = 'Sales') {
    const sales_id = "id TEXT";
    const outlet_id = "outlet_id TEXT";
    const outlet_name = "outlet_name TEXT";
    const receipt_no = "receipt_no TEXT";
    const sale_date_time = "sale_date_time TEXT";
    const total_inc_vat = "total_inc_vat NUMERIC";
    const vat = "vat NUMERIC";
    return `CREATE TABLE IF NOT EXISTS ${tableName} (${sales_id}, ${outlet_id}, ${outlet_name}, ${receipt_no}, ${sale_date_time}, ${total_inc_vat}, ${vat})`;

}

function createSalesItemTable(tableName = 'SalesItems') {
    const sales_item_id = "sales_item_id TEXT";
    const sales_id = "sales_id TEXT";
    const product_id = "product_id TEXT";
    const product_name = "product_name TEXT";
    const quantity = "quantity INTEGER";
    const total_inc_vat = "total_inc_vat NUMERIC";
    const vat = "vat NUMERIC";
    const primary_key = `PRIMARY KEY ("sales_item_id")`;
    return `CREATE TABLE IF NOT EXISTS ${tableName} (${sales_item_id}, ${sales_id}, ${product_id}, ${product_name}, ${quantity}, ${total_inc_vat}, ${vat}, ${primary_key})`
}

function createModifiersTable(tableName = 'Modifiers') {
    const modifier_id = "modifier_id TEXT";
    const sales_item_id = "sales_item_id TEXT";
    const modifier_name = "modifier_name TEXT";
    const price = "price NUMERIC";
    const quantity= "quantity NUMERIC";
    return `CREATE TABLE IF NOT EXISTS ${tableName} (${modifier_id}, ${sales_item_id}, ${modifier_name}, ${price}, ${quantity})`;
}

function createProductsTable() {
    const product_id = "product_id TEXT PRIMARY KEY";
    const parent_product_id = "parent_product_id TEXT";
    const category_id = "category_id TEXT";
    const product_name = "product_name TEXT";
    const product_sku = "product_sku TEXT";
    const display_name = "display_name TEXT";
    const purchase_price = "purchase_price NUMERIC";
    const supplier_purchase_price = "supplier_purchase_price NUMERIC";
    const selling_price = "selling_price NUMERIC";
    const has_variant = "has_variant INTEGER";
    const active = "active INTEGER";
    const brand_id = "brand_id TEXT";
    return `CREATE TABLE IF NOT EXISTS Products (${product_id}, ${parent_product_id}, ` +
        `${category_id}, ${product_name}, ${product_sku}, ${display_name}, ${purchase_price}, ${supplier_purchase_price}, ${selling_price}, ` +
        `${has_variant}, ${active}, ${brand_id})`
}

// Set default dates
//let fromDateString = "2019-01-01";
//default values - if we are dealing with an empty database, start from this point
let fromDateString = "2019-01-01";
let offset = 0;
db.get("SELECT FromDate, OffsetNumber FROM v_LatestUpdate", (err, row) => {
    if (!err && row.FromDate) {
        fromDateString = row.FromDate;
        offset = row.OffsetNumber;
    }
    getSalesData(fromDateString, offset)
    .then(data => {
        console.log('data received in getsales.js');
        saveSalesData(data)
        //console.log(data)
        //salesData = data;
    })
    .catch(err => {
        console.log("err received by getSalesData.js")
        console.log(err)
    });
})

// let toDateString = ""
// if (process.argv.length < 5) {
//     let todaysDate = new Date();
//     let yesterdaysDate = new Date(todaysDate);
//     yesterdaysDate.setDate(yesterdaysDate.getDate() - 1); // is this really the best way to do it?
//     fromDateString = formatDateString(yesterdaysDate);
//     toDateString = formatDateString(todaysDate); 
// } else {
//     fromDateString = process.argv[3];
//     toDateString = process.argv[4];
// }

// Retrieve JSON data from server

//let salesData = null;



function saveSalesData(salesData) {
    let salesAdded = 0;
    let salesItemsAdded = 0;
    let errorMessage = salesData.errorMessage ? salesData.errorMessage : "";

    db.serialize(() => {
        //db.run("DROP TABLE IF EXISTS Sales");
        console.log("running database actions")
        if (errorMessage) {
            // error message received - log error
            db.run(`INSERT INTO UpdateLog (TimeStamp, Result) VALUES (datetime('now'), '${errorMessage}')`);
        } else {
            // WRITE QUERIES==============================
            const salesInputArray = salesData.sales.map((sale) => {
                return [sale.id, sale.outlet.id, sale.outlet.outlet_name, sale.receipt_no, sale.sales_date_time, sale.sales_details.total_after_discount, sale.sales_details.vat_after_discount];
            })
            // create empty object for salesItems
            let salesItems = { "data": [] };
    
            // loop through each sale in salesData and extract all salesItems into salesItems array
            salesData.sales.forEach(sale => {
                sale.sales_details.sales_items.forEach(salesItem => {
                    salesItems.data.push(salesItem);
                });
            });

            // create a flat array for input into the db
            const salesItemsInputArray = salesItems.data.map(salesItem => {
                return [salesItem.id, salesItem.sales_id, salesItem.product_id, salesItem.product_name, salesItem.quantity, salesItem.line_total_after_discount, salesItem.line_vat_after_discount];
            })

            // create empty object for modifiers
            let modifiers = { "data": [] };

            //Loop through each salesItem in salesItems and extract all modifiers into modifiers array
            salesItems.data.forEach(salesItem => {
                if (salesItem.modifiers_array != null) {
                    salesItem.modifiers_array.forEach(modifier => {
                        modifier.sales_item_id = salesItem.id;
                        modifiers.data.push(modifier);
                    })
                }
                
            });
            
            const modifiersInputArray = modifiers.data.map(modifier => {
                return [modifier.id, modifier.sales_item_id, modifier.modifier_name, modifier.price, modifier.quantity];
            }) 
            let salesQuery = 
                "INSERT INTO UpdateSales (id, outlet_id, outlet_name, receipt_no, sale_date_time, total_inc_vat, vat) " +
                "VALUES (?, ?, ? ,?, ?, ?, ?)";
    
            let salesItemQuery =
                "INSERT INTO UpdateSalesItems (sales_item_id, sales_id, product_id, product_name, quantity, total_inc_vat, vat) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)"
            
            let modifierQuery = 
                "INSERT INTO UpdateModifiers (modifier_id, sales_item_id, modifier_name, price, quantity) " +
                "VALUES (?, ?, ?, ?, ?)"

            // SQL queries to create temp tables of records to insert
            let createTempSalesTable = "CREATE TEMP TABLE updateSalesMatches AS SELECT u.id as id FROM updateSales u LEFT JOIN Sales s ON u.id = s.id WHERE s.id IS NULL";
            let createTempSalesItemTable = "CREATE TEMP TABLE updateSalesItemMatches AS SELECT u.sales_item_id as sales_item_id FROM updateSalesItems u LEFT JOIN SalesItems si ON u.sales_item_id = si.sales_item_id WHERE si.sales_item_id IS NULL";
            // let createTempModifiersTable = "CREATE TEMP TABLE updateModifierMatches AS SELECT u.modifier_id as modifier_id FROM updateModifiers u LEFT JOIN Modifiers m ON u.modifier_id = m.modifier_id WHERE m.modifier_id IS NULL";

            //SQL queries to insert records into main tables
            let insertSalesQuery = "INSERT INTO Sales (id, outlet_id, outlet_name, receipt_no, sale_date_time, total_inc_vat, vat) SELECT u.id, u.outlet_id, u.outlet_name, u.receipt_no, u.sale_date_time, u.total_inc_vat, u.vat FROM UpdateSales u JOIN updateSalesMatches upd ON u.id = upd.id"
            let insertSalesItemQuery = "INSERT INTO SalesItems SELECT usi.sales_item_id, usi.sales_id, usi.product_id, usi.product_name, usi.quantity, usi.total_inc_vat, usi.vat FROM UpdateSalesItems usi JOIN updateSalesItemMatches matches ON usi.sales_item_id = matches.sales_item_id"
            let insertModifiersQuery = "INSERT INTO Modifiers SELECT um.modifier_id, um.sales_item_id, um.modifier_name, um.price, um.quantity FROM UpdateModifiers um"
    
            // Set up tables (if required)
            // CREATE TABLES======================================
            console.log("CREATE TABLES====================")
            db.run(createSalesTable());
            db.run("DROP TABLE IF EXISTS UpdateSales");
            db.run(createSalesTable('UpdateSales'));

            //db.run("DROP TABLE IF EXISTS SalesItems");
            
            db.run(createSalesItemTable());
            db.run("DROP TABLE IF EXISTS updateSalesItems");
            db.run(createSalesItemTable('UpdateSalesItems'));
            //db.run(createProductsTable());

            db.run(createModifiersTable());
            db.run("DROP TABLE IF EXISTS updateModifiers");
            db.run(createModifiersTable('updateModifiers'));

            // APPEND DOWNLOADED DATA TO UPDATE TABLES=============
            console.log("APPEND DOWNLOADED DATA TO UPDATE TABLES=============");
            // 'prepare' returns a 'statement' object which allows us to 
            // bind the same query to different parameters each time we run it
            let statementSales = db.prepare(salesQuery);

            // run the query over and over for each inner array
            for (var i = 0; i < salesInputArray.length; i++) {
                statementSales.run(salesInputArray[i], function (err) { 
                    if (err) throw err;
                });
            }

            // 'finalize' basically kills our ability to call .run(...) on the 'statement'
            // object again. Optional.
            statementSales.finalize();

            console.log("adding salesitems updates");
            let statementSalesItems = db.prepare(salesItemQuery);

            for (var i = 0; i < salesItemsInputArray.length; i++) {
                statementSalesItems.run(salesItemsInputArray[i], function (err) {
                    if (err) throw err;
                });
            }

            statementSalesItems.finalize();

            console.log("adding modifier updates");
            let statementModifiers = db.prepare(modifierQuery);

            for (var i = 0; i < modifiersInputArray.length; i++) {
                statementModifiers.run(modifiersInputArray[i], function (err) {
                    if (err) throw err;
                });
            }

            // INSERT NEW DATA INTO MAIN TABLES========================
            console.log("INSERT DATA==============")
            console.log("merging new data...")
            console.log("updating any sales changes...")
            // update process (MERGE statement not available)
            // 1. create temp tables of entries to update (prob 0)
            db.run(createTempSalesTable);
            db.run(createTempSalesItemTable);
            // 2. run update query to update sales table (again, prob 0 records)
            // db.run(updateSalesQuery, function(err) {
            //     if (err) {
            //         console.log("Error triggered in updateSalesQuery");
            //         return console.error(err.message);
            //     }
            //     console.log(`Rows updated: ${this.changes}`);
            // }); //update sales with any changes
            
            // 3. DROP the temp table
            // db.run("DROP TABLE updateMatches")
            //console.log(updateSalesQuery);
        
            // Insert new sales records
            console.log("inserting any new sales records")
            db.run(insertSalesQuery, function(err) {
                if (err) {
                    console.log("Error triggered in insertSalesQuery");
                    return console.error(err.message);
                }
                console.log(`Sales rows inserted: ${this.changes}`);
                console.log("log sales update history");
                db.run(`INSERT INTO UpdateLog (TimeStamp, Result) VALUES (datetime('now'), 'Added: ${this.changes} Sales')`);
            }); //add any new records to sales

            // Insert new salesItem records
            db.run(insertSalesItemQuery, function(err) {
                if (err) {
                    console.log("Error triggered in insertSalesItemQuery");
                    return console.error(err.message);
                }
                console.log(`SaleItems rows inserted: ${this.changes}`);
                console.log("log salesItem update history");
                db.run(`INSERT INTO UpdateLog (TimeStamp, Result) VALUES (datetime('now'), 'Added: ${this.changes} Items')`);
            }); //add any new records to salesItems

            // Insert new modifier records
            db.run(insertModifiersQuery, function(err) {
                if (err) {
                    console.log("Error triggered in insertModifiersQuery");
                    return console.error(err.message);
                }
                console.log(`Modifer rows inserted: ${this.changes}`);
                console.log("log modifier update history");
                db.run(`INSERT INTO UpdateLog (TimeStamp, Result) VALUES (datetime('now'), 'Added: ${this.changes} Modifiers')`);
            }); //add any new records to modifiers
            
        }
        
        // CLEAN UP ====================================================
        console.log("CLEAN UP=================");
        db.run("DROP TABLE IF EXISTS updateSalesMatches");
        db.run("DROP TABLE IF EXISTS updateSalesItemMatches");
        db.run("DROP TABLE IF EXISTS updateModifierMatches");
    });

    


}



