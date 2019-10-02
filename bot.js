const
    fs = require('fs'),
    request = require('request-promise'),
    format = require('string-format'),
    Redis = require('ioredis');

format.extend(String.prototype)

let config = process.argv[2] || __dirname + '\\config.json'
try {
    config = require(config)
} catch (e) {
    console.log("[ERROR] - Failed to get the config file " + config + ". Error: " + e.message)
    process.exit()
}

const options = {
    uri: 'https://www.humblebundle.com/store/api/search',
    qs: {
        sort: "discount",
        filter: "all",
        request: 1,
        page_size: config.humblebundle.game_count
    },
    json: true
}

request(options)
    .then((games) => {
        games.results.forEach((game) => {
            if (game.current_price[0] == 0) {
                game.link = "https://www.humblebundle.com/store/" + game.human_url
                game.expires = new Date(game.sale_end * 1000).toUTCString()
                if (config.redis.active) {
                    let redis = new Redis(config.redis.connection)
                    redis.sadd(game.sale_end, game.human_name, (err, res) => {
                        if (err) {
                            console.log("[ERROR] - An error occurred whilst adding to Redis: " + err.message)

                        }
                        if (res == 1) {
                            send(game)
                        }
                        redis.end()
                    });
                } else {
                    send(game)
                }
            }
        })
    })
    .catch((err) => {
        console.log("Failed to connect to the humblebundle API")
    })

async function send(game) {
    const options = {
        uri: "https://api.telegram.org/bot" + config.telegram.token + "/sendMessage",
        qs: {
            chat_id: config.telegram.chat_id,
            parse_mode: config.message.parse_mode,
            disable_web_page_preview: config.message.disable_web_page_preview,
            reply_markup: (config.message.button) ? ((!Object.keys(config.message.custom_reply_markup).length) ? "{\"inline_keyboard\":[[{\"text\":\"Get " + game.human_name + " Now!\",\"url\":\"" + game.link + "\"}]]}" : JSON.stringify(config.message.custom_reply_markup)) : {},
            disable_notification: config.message.disable_notification,
            text: config.message.text.format(game)
        },
        json: true
    }
    request(options)
        .then((response) => {

        })
        .catch((err) => {
            console.log("Failed to send the message to Telegram. Error: " + err.message)
        })
}
