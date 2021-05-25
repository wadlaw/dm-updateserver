
const express = require('express');
const goodTill = require('./goodtill');
const app = express();
require('dotenv'),config();
const port = process.env.PORT;


app.get('/',(req,res) => {
    res.send(`Localhost site for goodtill subdomain ${process.env.SUBDOMAIN || "not set"} - listening on port ${port}`)
})



app.get('/sales', async (req, res) => {
    console.log('requesting sales data');
    try {
        res.setTimeout(300000)
        const data = await goodTill.getSalesData("2021-01-15", "2021-01-25");
        // console.log('data received, returning to client')
        // console.log(data)
        res.json(data)
        
    } catch (err) {
        console.log("Error in app.get try/catch ", err)
    }
    
})

app.get('/home', (req, res) => {
    res.send('Localhost site')
})

app.get('/sales/from/:fromDate/to/:toDate', async (req, res) => {
    
    try {
        res.setTimeout(300000)
        const data = await goodTill.getSalesData(req.params.fromDate, req.params.toDate);
        // console.log('data received, returning to client')
        // console.log(data)
        res.json(data)
        
    } catch (err) {
        console.log("Error in app.get try/catch ", err)
    }
    // res.json = goodTill.getSalesData(req.params.fromDate, req.params.toDate)
    
    
    //res.setHeader('Content-Type', 'application/json');
    //res.end = await goodTill.getSales(req.params.fromDate, req.params.toDate)


/*     fetch('https://api/thegoodtill.com/api/external/get_sales', { 
        method: 'GET', 
        headers: { "Content-Type": "application/json", 
                    "Authorization": `Bearer ${getToken}`},
        body: JSON.stringify({ from: `${req.params.fromDate} 00:00:00`, to: `${req.params.toDate} 23:59:59`})
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }
        res.json(response.json);
        
    })
    .catch(err => {console.log(`Error: ${err.statusText}`)}) */
})



function logger(req, res, next) {
    //console.log(req.originalUrl);
    next();
    console.log(`${req.originalUrl} called`);
}

app.listen(port);

/* const data = { username: 'example' };

fetch('https://example.com/profile', {
  method: 'POST', // or 'PUT'
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
})
.then(response => response.json())
.then(data => {
  console.log('Success:', data);
})
.catch((error) => {
  console.error('Error:', error);
}); */



//------------------------
/* const fetch = require('node-fetch');

let url = "https://www.reddit.com/r/popular.json";

let settings = { method: "Get" };

fetch(url, settings)
    .then(res => res.json())
    .then((json) => {
        // do something with JSON
    }); */