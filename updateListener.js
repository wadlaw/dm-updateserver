const { updateSales, updateProducts, updateModifiers, updateCategories } = require('./getdata');
const amqp = require('amqplib');
const salesQueue = "dm_sales_update";
const staticDataQueue = "dm_static_update";
const amqpServer = "amqp://localhost:5672";
//5672 is the default port for rabbitmq
	

connect();

async function connect() {

	
	try {
		
		const connection = await amqp.connect(amqpServer);
		const channel = await connection.createChannel();
		await channel.assertQueue(salesQueue, { durable: true });
        await channel.assertQueue(staticDataQueue, { durable: true });
		channel.prefetch(1);
		channel.consume(salesQueue, msg => {
			// const recdMsg = JSON.parse(msg.content.toString());
			
            //process message - initiate sales update
            updateSales();

            //ack that we have received msg successfully
            channel.ack(msg);

		})
        channel.consume(staticDataQueue, msg => {
			const recdMsg = JSON.parse(msg.content.toString());
			
            //process message - check which type of update is requested
            switch (recdMsg.entity) {
                case "products":
                    updateProducts();
                    break;
                case "categories":
                    updateCategories();
                    break;
                case "modifiers":
                    updateModifiers();
                    break;
                default:
                    break;
            }

            //ack that we have received the message
            channel.ack(msg);
		})
		

	} catch (err) {
		console.error(err);
	}
}