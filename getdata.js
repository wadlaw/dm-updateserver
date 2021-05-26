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
    const product_name = "product_name TEXT";
    const product_sku = "product_sku TEXT";
    const category_name = "category_name TEXT";
    const quantity = "quantity INTEGER";
    const product_id = "product_id TEXT";
    const total_inc_vat = "total_inc_vat NUMERIC";
    const vat = "vat NUMERIC";
    const sales_id = "sales_id TEXT";
    return `CREATE TABLE IF NOT EXISTS ${tableName} (${product_name}, ${product_sku}, ${category_name}, ${quantity}, ${product_id}, ${total_inc_vat}, ${vat}, ${sales_id})`
}

function createProductsTable() {
    const product_id = "product_id TEXT PRIMARY KEY";
    const parent_product_id = "parent_product_id TEXT";
    const category_id = "category_id TEXT";
    const product_name = "product_name TEXT";
    const product_sku = "product_sku TEXT";
    const display_name = "display_name TEXT";
    const purchase_price = "purchase_price NUMERIC";
    const supplier_purchase_price = "supplioer_purchase_price NUMERIC";
    const selling_price = "selling_price NUMERIC";
    const has_variant = "has_variant INTEGER";
    const active = "active INTEGER";
    const brand_id = "brand_id TEXT";
    return `CREATE TABLE IF NOT EXISTS Products (${product_id}, ${parent_product_id}, ` +
        `${category_id}, ${product_name}, ${product_sku}, ${display_name}, ${purchase_price}, ${supplier_purchase_price}, ${selling_price}, ` +
        `${has_variant}, ${active}, ${brand_id})`
}

// Set default dates
let fromDateString = ""
let toDateString = ""
if (process.argv.length < 5) {
    let todaysDate = new Date();
    let yesterdaysDate = new Date(todaysDate);
    yesterdaysDate.setDate(yesterdaysDate.getDate() - 1); // is this really the best way to do it?
    fromDateString = formatDateString(yesterdaysDate);
    toDateString = formatDateString(todaysDate); 
} else {
    fromDateString = process.argv[3];
    toDateString = process.argv[4];
}

// Retrieve JSON data from server

//let salesData = null;
getSalesData(fromDateString, toDateString)
//goodTill.getSalesData("2021-05-01", "2021-05-17")
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
                return [sale.sales_id, sale.outlet_id, sale.outlet_name, sale.receipt_no, sale.sale_date_time, sale.total_inc_vat, sale.vat];
            })
            // create empty object for salesItems
            let salesItems = { "data": [] };
    
            // loop through each sale in salesData and extract all salesItems into salesItems array
            salesData.sales.forEach(sale => {
                sale.items.forEach(salesItem => {
                    salesItem.sales_id = sale.sales_id;
                    salesItems.data.push(salesItem)
                });
            });
            // console.log("salesItems object_____");
            // console.log(salesItems);
    
            // create a flat array for input into the db
            salesItemsInputArray = salesItems.data.map(salesItem => {
                return [salesItem.product_name, salesItem.product_sku, salesItem.category_name ? salesItem.category_name : "blank", salesItem.quantity, salesItem.product_id, salesItem.total_inc_vat, salesItem.vat, salesItem.sales_id]
            })
            // console.log("Sales Items__________");
            // console.log(salesItemsInputArray);
    
            let salesQuery = 
                "INSERT INTO UpdateSales (id, outlet_id, outlet_name, receipt_no, sale_date_time, total_inc_vat, vat) " +
                "VALUES (?, ?, ? ,?, ?, ?, ?)";
    
            let salesItemQuery =
                "INSERT INTO UpdateSalesItems (product_name, product_sku, category_name, quantity, product_id, total_inc_vat, vat, sales_id) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    
            let insertSalesQuery = "INSERT INTO Sales (id, outlet_id, outlet_name, receipt_no, sale_date_time, total_inc_vat, vat) SELECT u.id, u.outlet_id, u.outlet_name, u.receipt_no, u.sale_date_time, u.total_inc_vat, u.vat FROM UpdateSales u JOIN updateMatches upd ON u.id = upd.id"
            // let updateSalesQuery = "UPDATE Sales " +
            //                         "SET outlet_id = (SELECT outlet_id FROM updateMatches where updateMatches.id = Sales.id), " +
            //                         "outlet_name = (SELECT outlet_name FROM updateMatches where updateMatches.id = Sales.id), " +
            //                         "receipt_no = (SELECT receipt_no FROM updateMatches where updateMatches.id = Sales.id), " +
            //                         "sale_date_time = (SELECT sale_date_time FROM updateMatches where updateMatches.id = Sales.id), " +
            //                         "total_inc_vat = (SELECT total_inc_vat FROM updateMatches where updateMatches.id = Sales.id), " +
            //                         "vat = (SELECT vat FROM updateMatches where updateMatches.id = Sales.id) " +
            //                         "WHERE id IN (SELECT id FROM updateMatches)" 
            // let createTempSalesTable = "CREATE TEMP TABLE updateMatches AS " + 
            //         "SELECT u.id AS id, u.outlet_id AS outlet_id, u.outlet_name AS outlet_name, u.receipt_no AS receipt_no, u.sale_date_time AS sale_date_time, u.total_inc_vat AS total_inc_vat, u.vat AS vat " +
            //         "FROM UpdateSales u JOIN Sales s ON u.id = s.id " +
            //         "WHERE u.outlet_id <> s.outlet_id OR u.outlet_name <> s.outlet_name OR u.receipt_no <> s.receipt_no OR u.sale_date_time <> s.sale_date_time OR u.total_inc_vat <> s.total_inc_vat OR u.vat <> s.vat"
            let createTempSalesTable = "CREATE TEMP TABLE updateMatches AS SELECT u.id as id FROM updateSales u LEFT JOIN Sales s ON u.id = s.id WHERE s.id IS NULL"
            let insertSalesItemQuery = "INSERT INTO SalesItems SELECT usi.product_name, usi.product_sku, usi.category_name, usi.quantity, usi.product_id, usi.total_inc_vat, usi.vat, usi.sales_id FROM UpdateSalesItems usi JOIN updateMatches upd ON usi.sales_id = upd.id"
            // let updateSalesItemQuery = "UPDATE si " + 
            //     "SET s.id = u.id, s.outlet_id = u.outlet_id, s.outlet_name = u.outlet_name, s.receipt_id = u.receipt_id, s.sale_date_time= u.sale_date_time, s.total_inc_vat = u.total_inc_vat, s.vat = u.vat " +
            //     "FROM UpdateSales u INNER JOIN Sales s ON u.id = s.id " +
            //     "WHERE u.receipt_no <> s.receipt_no OR u.sale_date_time <> s.sale_date_time OR u.total_inc_vat <> s.total_inc_vat OR u.vat <> s.vat"
    
            // Set up tables (if required)
            // CREATE TABLES======================================
            console.log("CREATE TABLES====================")
            db.run(createSalesTable());
            db.run("DROP TABLE IF EXISTS UpdateSales");
            db.run(createSalesTable('UpdateSales'));

            //db.run("DROP TABLE IF EXISTS SalesItems");
            
            db.run(createSalesItemTable());
            db.run("DROP TABLE IF EXISTS updateSalesItems")
            db.run(createSalesItemTable('UpdateSalesItems'));
            //db.run(createProductsTable());


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

            // INSERT NEW DATA INTO MAIN TABLES========================
            console.log("INSERT DATA==============")
            console.log("merging new data...")
            console.log("updating any sales changes...")
            // update process (MERGE statement not available)
            // 1. create temp table of entries to update (prob 0)
            db.run(createTempSalesTable)
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
                    console.log("Error triggered in insertSalesQuery");
                    return console.error(err.message);
                }
                console.log(`SaleItems rows inserted: ${this.changes}`);
                console.log("log salesItem update history");
                db.run(`INSERT INTO UpdateLog (TimeStamp, Result) VALUES (datetime('now'), 'Added: ${this.changes} Items')`);
            }); //add any new records to sales

            
        }
        
        // CLEAN UP ====================================================
        console.log("CLEAN UP=================");
        db.run("DROP TABLE updateMatches");
    });

    


}



