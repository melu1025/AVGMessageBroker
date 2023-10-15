const fs = require("fs");
const amqp = require("amqplib/callback_api");

amqp.connect("amqp://localhost", (connectError, connection) => {
  if (connectError) {
    throw connectError;
  }

  connection.createChannel((channelCreationError, channel) => {
    if (channelCreationError) {
      throw channelCreationError;
    }

    const queueName = "rpc_queue";

    channel.assertQueue(queueName, {
      durable: false,
    });

    channel.prefetch(1);

    console.log(" [x] Warte auf Anfrage");

    channel.consume(queueName, (msg) => {
      const messageAsString = msg.content.toString();

      if (!messageAsString) {
        console.error("Leere Anfrage erhalten!");
      }

      const message = JSON.parse(messageAsString);

      callGeoApi(message).then((data) => {
        console.log(data);

        const dataAsString = JSON.stringify(data);

        fs.writeFileSync("log.txt", dataAsString + "\n", {
          flag: "a",
        });
        console.log("Anfrage in Log-Datei gespeichert");

        channel.sendToQueue(msg.properties.replyTo, Buffer.from(dataAsString), {
          correlationId: msg.properties.correlationId,
        });

        channel.ack(msg);
      });
    });
  });
});

async function callGeoApi(message) {
  const url = `https://geocode.maps.co/search?street=${message.hausnummer}+${message.straße}&city=${message.stadt}&land=${message.land}`;

  const response = await fetch(url);
  const geoData = await response.json();

  if (!geoData || geoData.length < 1) {
    console.error("Falsche Geo-Daten!");
    return;
  }

  const solarUrl = `https://api.forecast.solar/estimate/${geoData[0].lat}/${geoData[0].lon}/0/0/${message.solarLeistung}`;

  const response2 = await fetch(solarUrl);
  const solarData = await response2.json();

  if (!solarData) {
    console.error("Falsche Solar-Daten!");
    return;
  }

  return solarData;
}