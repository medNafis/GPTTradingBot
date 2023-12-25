const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca(); // Environment variables
const WebSocket = require('ws');
const axios = require('axios');
const dotenv = require('dotenv'); //Importing the dotenv package


// Load environment variables from the .env file
dotenv.config();
// Server < -- > Data Source
// Communication can go both ways
// Data source can send us information
// Send data to the data source (Authenticate, ask what data we want)

// Websockets are like push notifications on your phone
// Whenever an event happens you get a notification

const wss = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news");


wss.on('open', function(){
    console.log("Websocket connected!");

    const authMsg = {
        action: 'auth',
        key: process.env.APCA_API_KEY_ID,
        secret: process.env.APCA_API_SECRET_KEY
    }

    wss.send(JSON.stringify(authMsg)); // Send auth data to ws, "log us in"

    // Subscribe to all news feeds
    const subscribeMsg = {
        action: 'subscribe',
        news: ["*"] // ["TSLA"]
    }

    wss.send(JSON.stringify(subscribeMsg)); // Connecting us to the live data source of news
});

wss.on('message', async function(message){
    console.log("Message is " +message);
    // message is a STRING
    const currentEvent = JSON.parse(message)[0]; 

    if(currentEvent.T === "n") {

        let companyImpact = 0;
        try {
            // Construct the API request body
            const apiRequestBody = {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "Only respond with a number from 1-100 detailing the impact of the headline." },
                    { role: "user", content: `Given the headline '${currentEvent.headline}', show me a number from 1-100 detailing the impact of this headline.` }
                ]
            };

            // Call the OpenAI API
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                apiRequestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                    }
                }
            );

            // Extract the generated text from the OpenAI response
            const generatedText = response.data.choices[0]?.message.content.trim() || 'No response from OpenAI';

            // Log the generated text
            console.log(`Generated Text: ${generatedText}`);

            // Parse the impact number
            companyImpact = parseInt(generatedText);
            console.log(`Company Impact: ${companyImpact}`);

        } catch (error) {
            console.error('Error calling OpenAI API:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
                console.error('Response config:', error.response.config);
            }
        }

        const tickerSymbol = currentEvent.symbols[0];

        if (companyImpact >= 70){
            //Buy stock
            let order = await alpaca.createOrder({
                symbol: tickerSymbol, //npmjs.com/package/@alpacahq/alpaca-trade-api?activeTab=readme
                qty: 1,
                side: "buy",
                type: "market",
                time_in_force: "day" // if day ends, it wont trade.
            })
        } else if (companyImpact <= 30){
            //Sell stock
            let closedPosition = alpaca.closePosition(tickerSymbol);
        }

}})

