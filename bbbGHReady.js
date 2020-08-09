const https = require('https');
const crypto = require('crypto');
const mathjs = require('mathjs');

const hostVal = 'api.bybit.com';
const portVal = 443;
const symbol = 'BTCUSD';
const ticker = 'BTC'
const apiKey = 'removed';
const secret = 'removed';

const tradeAmount = 5;
const tradeInterval = 500;
const getBidAskLastInterval = 111;
const getOrdersInterval = 222;
const getPositionInterval = 666;
const sampleInterval = 60000;
const sampleSize = 16;
const stdMultBuy = -1;
const stdMultSell = 1;

var bidPrice;
var askPrice;
var lastPrice;
var timestamp;
var availableBalance;
var walletBalance;
var sampleArray = [];
var buyOrders = [];
var sellOrders = [];
var position;

function getSignature(paramStr){
  return crypto.createHmac('sha256', secret).update(paramStr).digest('hex');
}

function getBidAskLast(){
  const options = {
    host: hostVal,
    port: portVal,
    path: '/v2/public/tickers?symbol=' + symbol,
    method: 'GET'
  };

  https.request(options, function(res) {
    let data = ''
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      let infoJSON = JSON.parse(data)
      bidPrice = parseFloat(infoJSON.result[0].bid_price);
      askPrice = parseFloat(infoJSON.result[0].ask_price);
      lastPrice = parseFloat(infoJSON.result[0].last_price);
    })
  }).end();
}

function getTimestamp(){
  const options = {
    host: hostVal,
    port: portVal,
    path: '/v2/public/time',
    method: 'GET'
  };

  https.request(options, function(res) {
    let data = ''
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      let timeJSON = JSON.parse(data);
      let serverTime = timeJSON.time_now;
      timestamp = Math.floor(serverTime*1000)
    })
  }).end();
}

function getOrders(){
  let paramStr = "api_key=" + apiKey + "&limit=50" + "&order_status=New,PartiallyFilled" + "&symbol=" + symbol + "&timestamp=" + timestamp;
  let sign = getSignature(paramStr);

  const options = {
    host: hostVal,
    port: portVal,
    path: '/open-api/order/list?' + paramStr + "&sign=" + sign,
    method: 'GET'
  };

  https.request(options, function(res) {
    let data = ''
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      let ordersJSON = JSON.parse(data);
      if (ordersJSON.result != null){
        let orders = ordersJSON.result.data;
        buyOrders = [];
        sellOrders = [];
        for (i = 0; i < orders.length; i++){
          if (orders[i].side === 'Buy'){
            buyOrders.push(orders[i]);
          } else if (orders[i].side === 'Sell'){
            sellOrders.push(orders[i]);
          }
        }
      }
    })
  }).end();
}

function getPosition(){
  let paramStr = "api_key=" + apiKey + "&symbol=" + symbol + "&timestamp=" + timestamp;
  let sign = getSignature(paramStr);

  const options = {
    host: hostVal,
    port: portVal,
    path: '/v2/private/position/list?' + paramStr + "&sign=" + sign,
    method: 'GET'
  };

  https.request(options, function(res) {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      let positionJSON = JSON.parse(data);
      position = positionJSON.result;
    })
  }).end();
}

function createOrder(side, qty, price){
  let paramStr = "api_key=" + apiKey + "&order_type=Limit" + "&price=" + price + "&qty=" + qty + "&side=" + side + "&symbol=" + symbol + "&time_in_force=GoodTillCancel" + "&timestamp=" + timestamp;
  let sign = getSignature(paramStr);

  const options = {
    host: hostVal,
    port: portVal,
    path: '/v2/private/order/create?' + paramStr + "&sign=" + sign,
    method: 'POST'
  };

  https.request(options, function(res) {
    let data = ''
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
    })
  }).end();
}

function modifyOrder(orderId, qty, price){
  let paramStr = "api_key=" + apiKey + "&order_id=" + orderId + "&p_r_price=" + price + "&p_r_qty=" + qty + "&symbol=" + symbol + "&timestamp=" + timestamp;
  let sign = getSignature(paramStr);

  const options = {
    host: hostVal,
    port: portVal,
    path: '/open-api/order/replace?' + paramStr + "&sign=" + sign,
    method: 'POST'
  };

  https.request(options, function(res) {
    let data = ''
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
    })
  }).end();
}

function cancelOrder(orderId){
  let paramStr = "api_key=" + apiKey + "&order_id=" + orderId + "&symbol=" + symbol + "&timestamp=" + timestamp;
  let sign = getSignature(paramStr);

  const options = {
    host: hostVal,
    port: portVal,
    path: '/v2/private/order/cancel?' + paramStr + "&sign=" + sign,
    method: 'POST'
  };

  https.request(options, function(res) {
    let data = ''
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
    })
  }).end();
}

function takeSample(){
  let newSample = lastPrice;
  sampleArray.push(newSample);
  if (sampleArray.length > sampleSize){
    sampleArray.shift();
  }
  console.log(sampleArray);
}

function getInfo(){
  getBidAskLast();
  setInterval(getBidAskLast, getBidAskLastInterval);
  getOrders();
  setInterval(getOrders, getOrdersInterval);
  getPosition();
  setInterval(getPosition, getPositionInterval);
}

function computeSTD(){
  return mathjs.std(sampleArray);
}

function computeMeanPrice(){
  let sum = 0;
  for(i = 0; i < sampleArray.length; i++){
    sum += sampleArray[i];
  }
  return (sum / sampleArray.length);
}

function cancelBuyOrders(startIndex){
  for (i = startIndex; i < buyOrders.length; i++){
    cancelOrder(buyOrders[i].order_id);
  }
}

function openLong(){
  let stdPrice = (Math.round(2 * (computeMeanPrice() + (computeSTD() * stdMultBuy)))) / 2;
  let bestBuyPrice = Math.min(stdPrice, bidPrice);
  let bestQty = tradeAmount;
  if (position != null){
    if (position.side === 'Buy'){
      bestQty -= position.size;
    } else if(position.side === 'Sell'){
      bestQty += position.size;
    }
  }
  if (bestQty > 0){
    if (buyOrders.length == 0){
      createOrder('Buy', bestQty, bestBuyPrice);
    } else if (buyOrders.length >= 1){
      modifyOrder(buyOrders[0].order_id, bestQty, bestBuyPrice);
      cancelBuyOrders(1);
    }
  } else {
    cancelBuyOrders(0);
  }
}

function cancelSellOrders(startIndex){
  for (i = startIndex; i < sellOrders.length; i++){
    cancelOrder(sellOrders[i].order_id);
  }
}

function closeLong(){
  if (position != null){
    if (position.side === 'Buy'){
      let stdPrice = (Math.round((computeMeanPrice() + (computeSTD() * stdMultSell)) * 2)) / 2;
      let bestSellPrice = Math.max(stdPrice, askPrice);
      if (sellOrders.length == 0){
        createOrder('Sell', position.size, bestSellPrice);
      } else if (sellOrders.length >= 1){
        modifyOrder(sellOrders[0].order_id, position.size, bestSellPrice);
        cancelSellOrders(1); //cancel all sell orders except 1
      }
    } else {
      cancelSellOrders(0); //cancel ALL sell orders
    }
  }
}

function trade(){
  if (sampleArray.length >= sampleSize){
    openLong();
    closeLong();
  }
}

function main2(){
  trade();
  setInterval(trade, tradeInterval);
}

function main(){
  getInfo();
  takeSample();
  setInterval(takeSample, sampleInterval);
  setTimeout(main2, 1111);
}


getTimestamp();
setInterval(getTimestamp, 1000);
getBidAskLast();

setTimeout(main, 1111);
