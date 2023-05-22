# ES -> Amplitude Importer

A (very improvised) JS importer that extracts records from Elasticsearch and imports them into an Amplitude instance.

### Usage

1. Insert Amplitude API Key into an `.env` file (see `.env_example`)
2. Download the `qbox-cluster-backup` (or another applicable ES 1.7.4 export) to the root of this directory.
3. `lando start`
4. Run the following cURL command to create the ES "repository". This will tell your Lando-hosted ES instance where the backup from Qbox exists.

```
curl --location --request PUT 'http://elasticsearch-project.lndo.site/_snapshot/backups' \
--header 'Content-Type: application/json' \
--data '{
"type": "url",
"settings": {
"url": "file:/app/qbox-cluster-backup/0/indices"
  }
}'
```
5. If applicable, find the date of the last record imported. We're currently importing legacy Lando metrics data from the most recent records to the oldest records (reverse chronological).
1. You should be able to run the Node script, making sure to insert the last time as an argument: (`lando ssh -s node -c "node index.js 2022-09-26T00:02:50.006Z"`) 