//const { response } = require('express');
const { spawn } = require('child_process');
const { json } = require('express');
const fetch = require('node-fetch');

//import environment variables





async function requestToken() {
    // console.log('RequestToken is running');
    // const subdomain = process.env.SUBDOMAIN || "subdomain"
    // const username = process.env.USERNAME || "username"
    // const password = process.env.PASSWORD || "password"

    const subdomain = process.env.SUBDOMAIN
    const username = process.env.USERNAME
    const password = process.env.PASSWORD
    
    //console.log(`subdomain: ${subdomain} | username: ${username} | password: ${password}`);

    let response = await fetch('https://api.thegoodtill.com/api/login', { 
            method: 'POST', 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({
                "subdomain": subdomain,
                "username": username,
                "password": password
            })
    })
    return response.json();
};

async function login() {
    let response = await requestToken();
    return response.token;
};

async function logout(token) {
    // console.log('logout function running')
    const response = await fetch('https://api.thegoodtill.com/api/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
    })
    // console.log('logout response received')
    return response.json()
    
}

function getURL(entity) {
    // return the correct url based on the parameter passed to the script

    switch (entity) {
        
        case "products":
            return "https://api.thegoodtill.com/api/products";
            break;
        case "categories":
            return "https://api.thegoodtill.com/api/categories";
            break;
        case "modifiers":
            return "https://api.thegoodtill.com/api/modifiers";
            break;
        case "sales":
        default:
            // return "https://api.thegoodtill.com/api/external/get_sales"
            return "https://api.thegoodtill.com/api/external/get_sales_details";
            break;
        
    }
}

async function getSalesData(fromDate, offset) {
    console.log('Requesting access token...')

    try {
        const token = await login();
        console.log('Token acquired')
        //console.log(token);
        
        const data = await getSales(fromDate, offset, token)
        console.log(`${data.sales.length} transactions downloaded`)
        // console.log('Logging out...')
        const inactivate = await logout(token)
        console.log(inactivate.message)

        return data

    } catch (err) {
        console.log('error detected (getSalesData)')
        console.log(err)
    }
    

};

async function getSales(fromDate, offset, token) {
    let errorDetected = false;
    let recordsReturned = 0;
    const limit = 50;
    // let from = dateParse(fromDate);
    // let to = dateParse(toDate)
    // let bufferFrom = new Date(from);
    const jsonData = { "sales": [] }
    // console.log(from, " - ", to )
    do {

        await getJSONResponse2(token, fromDate, offset + jsonData.sales.length, limit)
            .then(response => {
                let substrings = response.split("\n");
                let status = substrings[0].split(" ")[1];
                console.log(`goodtill response: ${status}`);
                
                if (status.slice(0,1) == "2") {
                    // success response, return json string which is last substring
                    return substrings[substrings.length - 1];
                } else {

                    throw new Error(`${status} response received from goodtill`);
                }
            })
            .then(json => {
                let data = JSON.parse(json);
                recordsReturned = data.data.length;
                jsonData.sales = jsonData.sales.concat(data.data);
                console.log(`${data.data.length} new transactions downloaded. Total of ${jsonData.sales.length} downloaded`)
            })
            .catch(err => {
                errorDetected = true;
                jsonData.errorMessage = err.message;
                console.error(err);
            })

    }
    while (!errorDetected && recordsReturned == limit)
    
    return jsonData
    
}

// async function getProductsData() {
//     console.log('Requesting access token...')

//     try {
//         const token = await login();
//         console.log('Token acquired')
        
//         const resp = await fetch(getURL("products"), {
//             method: 'GET',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`
//             }
//         })
//         const products = await resp.json();
//         // const products = await getJSONResponse(geturl(), token)
//         console.log(`${products.data.length} products downloaded`)
//         // console.log('Logging out...')
//         const inactivate = await logout(token)
//         console.log(inactivate.message)

//         return products

//     } catch (err) {
//         console.log('error detected (getProductsData)')
//         console.log(err)
//     }
// }

// async function getCategoriesData() {
//     console.log('Requesting access token...')

//     try {
//         const token = await login();
//         console.log('Token acquired')
        
//         const resp = await fetch(getURL("categories"), {
//             method: 'GET',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`
//             }
//         })
//         const categories = await resp.json();
//         // const products = await getJSONResponse(geturl(), token)
//         console.log(`${categories.data.length} categories downloaded`)
//         // console.log('Logging out...')
//         const inactivate = await logout(token)
//         console.log(inactivate.message)

//         return categories

//     } catch (err) {
//         console.log('error detected (getCategoriesData)')
//         console.log(err)
//     }
// }


async function getData(dataType) {
    console.log('Requesting access token...')

    try {
        const token = await login();
        console.log('Token acquired')
        
        const resp = await fetch(getURL(dataType), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        const retrievedData = await resp.json();
        // const products = await getJSONResponse(geturl(), token)
        console.log(`${retrievedData.data.length} ${dataType} downloaded`)
        // console.log('Logging out...')
        const inactivate = await logout(token)
        console.log(inactivate.message)

        return retrievedData

    } catch (err) {
        console.log(`error detected (getData(${dataType}))`)
        console.log(err)
    }
}

async function getJSONResponse(url, token) {
    
    const curlParams = `-i -X GET -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" --url ${url}`;
    console.log(`retrieving data from ${url}...`)
    const results = await captureStream(curlParams)
    // console.log('Results of captureStream received. ',`Results type is: ${typeof results}`)
    
    //console.log('Results: "',results,'"');
    return results;
}

async function getJSONResponse2(token, fromDate = '', offset, limit) {
    //build request 
    let curlParams = `-i -X GET -H "Content-Type: application/json" -H "Authorization: Bearer ${token}"`; //add message headers
    curlParams += (fromDate) ? ` -d '{"from": "${fromDate} 00:00:00", "limit": ${limit}, "offset": ${offset} }'` : ""; //add message body
    curlParams += ` --url "${getURL("sales")}"`; //add url
    //console.log(curlParams);
    //const curlParams = `-X GET -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '{"from": "${fromDate} 00:00:00", "to": "${toDate} 23:59:59"}' --url "${url}"`;
    console.log(`retrieving data from ${fromDate} offset by ${offset} sales...`)
    const results = await captureStream(curlParams)
    // console.log('Results of captureStream received. ',`Results type is: ${typeof results}`)
    
    //console.log('Results: "',results,'"');
    return results;
}


function captureStream (curlParams) {
    // console.log('capture stream running');
    const curlCommand = 'curl ' + curlParams
    // console.log(curlCommand)
    
    const curl = spawn(curlCommand, { shell: true })
    const chunksErr = []
    const chunksOut = []
    return new Promise((resolve, reject) => {
    //   curl.stderr.on('data', chunk => {
    //       console.log('Stderr data chunk received')
    //       chunksErr.push(chunk)
    //     })
    //   curl.stderr.on('error',err => {
    //       console.log(`Error occurred from stream, rejecting.`)
    //       console.log(err)
    //       reject
    //     })
    //   curl.stderr.on('end', () => {
    //       console.log('stderr stream end')
    //       console.log('strerr chunks contents:')
    //       console.log(chunksErr)
    //       errString = Buffer.concat(chunksErr).toString()
    //       console.log("Err string:\n",errString)
    //       resolve(Buffer.concat(chunksErr).toString())
    //     })
    curl.stdout.on('data', chunk => {
    //   console.log('Stdout data chunk received')
        chunksOut.push(chunk)
    })
    curl.stdout.on('error', err => {
        console.log('Stdout error, rejecting')
        console.log(err)
        reject
    })
    curl.stdout.on('end', () => {
    //   console.log('stdout stream end')
    //   console.log('stdout chunks contents:')
    //   console.log(chunksOut)
    //   outString = Buffer.concat(chunksOut).toString()
    //   console.log("Out string:\n",outString)
        resolve(Buffer.concat(chunksOut).toString())
    })
})
}
  
function dateParse(dateString) {
    
    try {
        parts = dateString.split("-")
        returnDate = new Date(parts[0], parts[1]-1, parts[2])
        // console.log('Date Parsing: ',`${dateString}->${returnDate}`)
        return returnDate
    } catch (err) {
        console.log(`error in dateParse. Parameter passed was ${dateString}`)
        console.log(err)
    }
}

function formatDateString(theDate) {
    // console.log("formatting date string of type ", typeof theDate)
    // console.log(theDate)
    var dateString =
        theDate.getFullYear() + "-" +
        ("0" + (theDate.getMonth()+1)).slice(-2) + "-" +
        ("0" + theDate.getDate()).slice(-2)

    return dateString;
}

module.exports = { "getSalesData": getSalesData, "getData": getData, "formatDateString": formatDateString }