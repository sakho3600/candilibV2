#!/bin/sh

sleep 5
mongo --host mongo-primary -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --eval "rs.initiate({
  \"_id\": \"rs0\",
  \"members\": [{
    \"_id\": 0,
    \"host\": \"mongo-primary:27017\"
  }, {
    \"_id\": 1,
    \"host\": \"mongo-secondary:27017\"
  }, {
    \"_id\": 2,
    \"host\": \"mongo-arbiter:27017\",
    \"arbiterOnly\": true
  }],
})"
