const elasticsearch = require('elasticsearch');
const request = require('node-fetch');
var _ = require('lodash');
const client = new elasticsearch.Client({ host: 'http://elasticsearch:9200' });

async function upload(events) {
  // Make reqest to Amplitude
  const headers = {
    'Content-Type':'application/json',
    'Accept':'*/*'
  };
    
  const inputBody = {
    "api_key": process.env.AMPLITUDE_KEY,
    "events": events,
  };
 
  await request('https://api2.amplitude.com/batch',
    {
    method: 'POST',
    body: JSON.stringify(inputBody),
    headers: headers
    })
    .then(function(res) {
      return res.json();
    }).then(function(body) {
      console.log('amplitude response', body);
    });

}

async function fetchElasticData(size = 10, startDate = "2023-01-01T00:00:00") {
  // define a search query
  var searchParams = {
    index: 'logstash-metricsv4',
    scroll: '1m',
    size: size,
    body: {
      sort: [{ created: 'desc' }],
      filter: {
        range: {
          created: {
            gte: "2015-01-01T00:00:00",
            lt: startDate
          },
        },
      }, 
    },
  };

  // start the initial search request
  const responseQueue = [await client.search(searchParams)];
  var count = 0;

  while (responseQueue.length) {
    const response = responseQueue.shift();
    var events = [];
  
    // collect the titles from this response
    console.log('# responses ', response.hits.hits.length);
    response.hits.hits.forEach(function (data) {
      data = data._source;
      var platform = _.get(data, 'product') + '-local-' + _.get(data, 'mode');
      var date = new Date(_.get(data, 'created'));
      var milliseconds = date.getTime();
      data.insert_id = _.get(data, 'instance') + _.get(data, 'action') + milliseconds; 

      // Don't upload errors.
      if (_.get(data, 'action') !== 'error') {
        events.push({
          device_id: _.get(data, 'instance'),
          user_id: _.get(data, 'instance'),
          event_type: _.get(data, 'action'),
          os_name: _.get(data, 'os.platform', null),
          os_version: _.get(data, 'os.release', null),
          //We don't have context in ES? ${data.context}-
          platform: platform,
          app_version: _.get(data, 'version'),
          time: milliseconds,
          event_properties: data,
          insert_id: _.get(data, 'insert_id'), 
        });
      }
    });
    upload(events);
    count = count + size;
    console.log(`${count} events processed out of ${response.hits.total}`);
    var lastDate = events.pop().event_properties.created;
    console.log(`Last date was ${lastDate}`);

    // check to see if we exported everything
    if (response.hits.total === count) {
      console.log('All events uploaded.')
      break
    }
  
    // get the next response if there are more titles to fetch
    responseQueue.push(
      await client.scroll({
        scrollId: response._scroll_id,
        scroll: '1m',
      })
    );
  }
}

fetchElasticData(10, "2022-07-26T00:02:50.006Z");