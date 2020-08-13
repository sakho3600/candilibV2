mongo -- "$MONGO_INITDB_DATABASE" <<EOF
var root_user = '$MONGO_INITDB_ROOT_USERNAME';
var root_pass = '$MONGO_INITDB_ROOT_PASSWORD';
var admin = db.getSiblingDB('admin');
admin.auth(root_user, root_pass);

EOF
