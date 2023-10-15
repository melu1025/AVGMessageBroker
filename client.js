const amqp = require('amqplib/callback_api');
const readline = require('readline');

const lesen = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

//Eingabeaufforderung für die Anfrage
lesen.question('Bitte geben Sie das Land ein: ', (land) => {
  lesen.question('Bitte geben Sie die Stadt ein: ', (stadt) => {
    lesen.question('Bitte geben Sie die Straße ein: ', (straße) => {
      lesen.question('Bitte geben Sie die Hausnummer ein: ', (hausnummer) => {
        lesen.question('Bitte geben Sie die Leistung der vorhandenen Solaranlage in kW ein: ', (solarLeistung) => {
          if (!land || !stadt || !straße || !hausnummer || !solarLeistung) {
            console.log("Ungültige Eingabe. Bitte geben Sie alle erforderlichen Informationen an.");
            lesen.close();
            process.exit(1);
          }
          //Herstellung der Verbindung zum Message Broker
          amqp.connect('amqp://localhost', function (error0, connection) {
            if (error0) {
              throw error0;
            }
            connection.createChannel(function (error1, channel) {
              if (error1) {
                throw error1;
              }
              channel.assertQueue('', {
                exclusive: true
              }, function (error2, q) {
                if (error2) {
                  throw error2;
                }

                const Anfragedaten = {
                  land,
                  stadt,
                  straße,
                  hausnummer,
                  solarLeistung
                };

                console.log(' [x] Anfrage für %s, %s, %s, %s, Solaranlagenleistung: %s kW', land, stadt, straße, hausnummer, solarLeistung);
                console.log(' [x] Anfrage wird bearbeitet...');

                // Hier kommen die Daten vom Message Broker zurück
                channel.consume(q.queue, function (msg) {
                  try {
                    const jsonData = JSON.parse(msg.content.toString());
                
                    // Überprüfen, ob die erwarteten Eigenschaften vorhanden sind
                    if (jsonData && jsonData.result && jsonData.result.watt_hours_day) {
                      const wattHoursDay = jsonData.result.watt_hours_day;
                      
                      console.log('\n');
                      console.log('Für die eingegebene Adresse wurde folgende Solarproduktion gemessen: \n');
                      
                      for (const date in wattHoursDay) {
                        if (wattHoursDay.hasOwnProperty(date)) {
                          const value = wattHoursDay[date];
                          console.log(`Datum: ${date}, Wert: ${value} kW`);
                        }
                      }

                      console.log('\n');
                      console.log(' [x] Anfrage wurde abgeschlossen...');
                      console.log('\n');
                    } else {
                      console.log("Ungültiges Datenformat oder fehlende Eigenschaften in der Nachricht.");
                    }
                  } catch (error) {
                    console.error("Fehler beim Parsen der Nachricht: " + error);
                  }
                
                  setTimeout(function () {
                    connection.close();
                    process.exit(0);
                  }, 500);
                }, {
                  noAck: true
                });

                channel.sendToQueue('rpc_queue',
                  Buffer.from(JSON.stringify(Anfragedaten)), {
                    replyTo: q.queue
                  });
              });
            });
          });

          lesen.close();
        });
      });
    });
  });
});