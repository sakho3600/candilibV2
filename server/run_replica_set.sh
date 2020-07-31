#!/bin/sh

sudo su <<EOF

mkdir ${DBDATA:-../mongo}/.dockerMongoRepl
mkdir ${DBDATA:-../mongo}/.dockerMongoRepl/keyfile

openssl rand -base64 756 > ${DBDATA:-../mongo}/.dockerMongoRepl/keyfile/mongo-cluster-key
chmod 400 ${DBDATA:-../mongo}/.dockerMongoRepl/keyfile/mongo-cluster-key
chown 999:999 ${DBDATA:-../mongo}/.dockerMongoRepl/keyfile/mongo-cluster-key
EOF

sudo docker-compose up -d
