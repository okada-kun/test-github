var MAX_CLIENTS = 4;
var YES = 777;
var NO = 778;

var http = require("http");
var socketio = require("socket.io");
var fs = require("fs");
var mysql = require("mysql");

/*カンパイ人数　予め管理者が決めておく　defaultは10*/
var KANPAI_MAX_CLIENT = 10;

/*カンパイルームに人がいるかどうか*/
var judge_kanpai_room = NO;

/*ラズベリーPi　通信を受け取った人の情報を記録しておく*/
var kanpai_name = new Array(MAX_CLIENTS);
var kanpai_socket = new Array(MAX_CLIENTS);
var kanpai_hobby = new Array(MAX_CLIENTS);
var current_time = "2099/9/9";
var now = new Date(); /*現在の日を取得*/
var yobi= new Array("Sun","Mon","Tue","Wed","Thus","Fri","Sat");
current_time = now.getFullYear() + "/" + (now.getMonth()+1) + "/" + now.getDate() + "(" + yobi[now.getDay()] + ")";

/*その人がhobby matchしたかどうか*/
var hobby_match = NO;
var match;

/*login画面の情報を保持するための変数*/
var login_name = "zdefault";
var login_pass = "zdefault";

/*カンパイ受付時間 いまは1秒*/
var KANPAI_LIMIT_TIME = 1000;

/*初期化する変数*/
function initialize() {
  console.log("初期化しました");
  for(var i = 0; i < MAX_CLIENTS; i++) {
    kanpai_name[i] = "zdefault";
    kanpai_hobby[i] = "zdefault";
  }
}

/*カンパイルームから退出させる*/
function to_exit_kanpai_room　() {
  console.log("カンパイルームから全員追い出しました");
  for(var i = 0; i < MAX_CLIENTS; i++) {
    if(kanpai_name[i] != "zdefault") {
      kanpai_socket[i].leave('kanpai_room');
    }
  }
}

/*カンパイ不成功を伝える*/
function kanpai_failed　() {
  console.log("カンパイ失敗");
  kanpai_socket[0].emit('fail');
  judge_kanpai_room = NO;
}

/*カンパイ成功をルームにいる全員に伝える*/
function kanpai_success　() {
  /*DB Connection*/
  var recv_data;
  var sql;
  var query;

  console.log("カンパイ成功");
  
  /*挿入ソートでkanpai_nameをソートする*/
  isort();

  /*何人とカンパイしたのか*/
  var kanpai_number = 1;/*デフォルト 1*/

  for(var i = 0; i < MAX_CLIENTS; i++) {

    if(kanpai_name[i] == "zdefault") {
      kanpai_number = i-1;
      break;
    }

  }

  for(var i = 0; i < MAX_CLIENTS; i++) {
    if(kanpai_name[i] != "zdefault") {
      kanpai_socket[i].leave('kanpai_room');

      for(var j = 0; j < MAX_CLIENTS; j++) {
        if(j != i && kanpai_name[j] != "zdefault") {
          /*SQL insert for privateDB*/
          sql = "insert into " +kanpai_name[i]+ " (user_name,kanpai_count,last_kanpai_time,hobby) values ('" + kanpai_name[j] + "',1,'" + current_time + "' ,'" + kanpai_hobby[j]+ "') on duplicate key update kanpai_count = kanpai_count + 1,last_kanpai_time = '" + current_time + "';";
          query = mysql_connecion.query(sql,[recv_data]);

          if(i < j) {
            /*SQL insert for administratorDB*/
            sql = "insert into administrator (user_name1,user_name2,kanpai_count,last_kanpai_time) values ('" + kanpai_name[i] + "','" + kanpai_name[j] + "',1,'" + current_time + "') on duplicate key update kanpai_count = kanpai_count + 1,last_kanpai_time = '" + current_time + "';";
            query = mysql_connecion.query(sql,[recv_data]);
          }

          /*hobby judge*/
          if(kanpai_hobby[i] == kanpai_hobby[j]) {
            console.log("match");
            hobby_match = YES;
          }
        }
      }

      /*趣味によるマッチング*/
      if(hobby_match == YES) {
        match = true;
      }
      else {
        match = false;
      }
      console.log("match:" + match);
      kanpai_socket[i].emit('success',match,kanpai_number);
      hobby_match = NO;
    }
  }
  judge_kanpai_room = NO;
}

/*カンパイルームに入る際に名簿に名前を書いてもらう*/
function insert_user_information　(name,socket,hobby) {
  console.log("name:" + name);
  for(var i = 0; i < MAX_CLIENTS; i++) {
    if(kanpai_name[i] == "zdefault") {
      kanpai_name[i] = name;
      kanpai_socket[i] = socket;
      kanpai_hobby[i] = hobby;
      if(i == 0) {
        judge_kanpai_room = YES;
        console.log("一人目が入りました");
      }
      else {
        console.log("二人目以降が入りました");
      }
      break;
    }
  }
}

function isort() {
  for (var i = 1; i < kanpai_name.length; i++) {
    var n_tmp = kanpai_name[i];
    var s_tmp = kanpai_socket[i];
    var h_tmp = kanpai_hobby[i];

    if (kanpai_name[i - 1] > n_tmp) {
      var j = i;

      while (j > 0 && kanpai_name[j - 1] > n_tmp) {
        kanpai_name[j] = kanpai_name[j - 1];
        kanpai_socket[j] = kanpai_socket[j - 1];
        kanpai_hobby[j] = kanpai_hobby[j - 1];
        j--;
      }
      kanpai_name[j] = n_tmp;
      kanpai_socket[j] = s_tmp;
      kanpai_hobby[j] = h_tmp;
    }
  }
  return;
}

function insert(username,targetname) {
  console.log("insert now");
  /*SQL insert for privateDB*/
  var recv_data;
  var sql;
  var query;
  sql = "insert into " + username + " (user_name,kanpai_count,last_kanpai_time,hobby) values ('" + targetname + "',0,'" + current_time + "' ,'default') on duplicate key update kanpai_count = kanpai_count,last_kanpai_time = '" + current_time + "';";
  query = mysql_connecion.query(sql,[recv_data]);
  return;
}

/*初期化*/
initialize();

/*http Server設定*/
var server = http.createServer(function(req, res) {
  res.writeHead(200, {"Content-Type":"text/html"});
  var output;
  if(req.url == "/index") {
    output = fs.readFileSync("./index2.html", "utf-8");
  }
  else {
    output = fs.readFileSync("./login.html", "utf-8");
  }
  res.end(output);
}).listen(process.env.VMC_APP_PORT || 3000);

/*MySQL とのコネクション設定*/
var mysql_connecion = mysql.createConnection( {
  host    :'127.0.0.1',
  user    :'root',
  password:'',
  database:'kanpaiDB'
});

/*MySQLとの接続*/
mysql_connecion.connect();

/*Server起動*/
var io = socketio.listen(server);

/*カンパイ受付終了*/
function kanpai_end() {
  to_exit_kanpai_room();
  if(kanpai_name[1] == "zdefault") {
    kanpai_failed();
  }
  else {
    kanpai_success();
  }
  initialize();
}

io.sockets.on("connection", function (socket) {

  socket.on("login", function (data) {
    var user_name = data.name;
    var user_hobby = data.hobby;

    /*socket.emit("idol");*/
    socket.emit("send_kanpai_clients",KANPAI_MAX_CLIENT);

    /*DB Connection*/
    var recv_data;
    var sql = "create table if not exists " +user_name+ " (user_name varchar(64) primary key,kanpai_count integer,last_kanpai_time varchar(64),hobby varchar(256));";
    var query = mysql_connecion.query(sql,[recv_data]);

    /*sql = "insert into " + user_name + " (user_name,kanpai_count,last_kanpai_time,hobby) values ('" + user_name+ "',0,'2015/9/1','" +user_hobby+ "');";*/
    sql = "insert into " + user_name + " (user_name,kanpai_count,last_kanpai_time,hobby) values ('" + user_name + "',1,'" + current_time + "' ,'" + user_hobby+ "') on duplicate key update kanpai_count = kanpai_count,last_kanpai_time = '" + current_time + "';";
    query = mysql_connecion.query(sql,[recv_data]);

    query.on('error',function(err) {
      console.log('err is: ',err);
    });
  });

  socket.on("ok", function () {
    socket.emit("idol");
  });

  socket.on("user_login", function (data) {
    login_name = data.name;
    login_pass = data.pass;
  });

  socket.on("require_user_data", function () {
    socket.emit("recv_user_data",{name:login_name,pass:login_pass});
  });

  socket.on("insertDB", function (data) {
    insert(data.username,data.targetname);
    /*console.log("will insert DB:" + data.username  + "into" + data.targetname);*/
    socket.emit("complete");
  });

  socket.on("entry_kanpai_num", function (data) {
    KANPAI_MAX_CLIENT = data.num;
    console.log("kanpai_count: " + KANPAI_MAX_CLIENT);
    socket.emit("complete");
  });

  /*メッセージ送信（送信者にも送られる）*/
  socket.on("C_to_S_message", function (data) {
    io.sockets.emit("S_to_C_message", {value:data.value});
  });

  /*ブロードキャスト（送信者以外の全員に送信）*/
  socket.on("C_to_S_broadcast", function (data) {
    socket.broadcast.emit("S_to_C_message", {value:data.value});
  });

  /*送信者に送信*/
  socket.on("C_to_S_me", function (data) {
    socket.emit("S_to_C_message", {value:data.value});
  });

  /*kanpai_roomに送信*/
  socket.on("send_kanpai_room", function (data) {
    io.sockets.in('kanpai_room').emit('send_kanpai_room',{value:data.value});
  });

  /*ﾗｽﾞﾍﾞﾘｰPiからカンパイの合図が飛んできた場合 dataにはuser_nameが送信されてくる*/
  socket.on("kanpai",function (data) {
    console.log("カンパイルームに入りました");
    console.log("judge_kanpai_room:" + judge_kanpai_room)
    /*user情報の受け取り*/
    var user_name = data.name;
    var user_hobby = data.hobby;
    var user_socket = socket;

    /*kanpai_roomに入れる*/
    user_socket.join('kanpai_room');

    /*KANPAI_LIMIT_TIME後にkanpai_roomから退出させられる*/
    if(judge_kanpai_room == NO) {
      setTimeout(function() { 
        kanpai_end(); 
      }, KANPAI_LIMIT_TIME);
    }
    insert_user_information　(user_name,user_socket,user_hobby);

  });

  /*DBの中身をチェックする dataにはuser_nameが送信されてくる*/
  socket.on("DBcheck",function (data) {
    console.log("DB確認");
    var user_name = data.value;

    /*DB Connection*/
    var sql = "select * from "+ user_name + " order by kanpai_count desc;";
    var recv_data;

    var query = mysql_connecion.query(sql,[recv_data]);

    query.on('error',function(err) {
      console.log('err is: ',err);
    });

    query.on('result', function(rows) {
      console.log("user_name : " +  rows.user_name);
      console.log("kanpai_count : " +  rows.kanpai_count);
      console.log("lats_kanpai_time : " +  rows.last_kanpai_time);
      console.log("hobby :" + rows.hobby + "\n");
      socket.emit("DBexpress", {name:rows.user_name,count:rows.kanpai_count,time:rows.last_kanpai_time,hobby:rows.hobby});
    });

    /*query.on('end', function() {
      console.log('end');
      mysql_connecion.destroy();
    });*/
  });

  /*DBの中身をチェックする dataにはuser_nameが送信されてくる*/
  socket.on("administrator_DBcheck",function (data) {
    console.log("DB確認(reader)");
    var user_name = "administrator";

    /*DB Connection*/
    var sql = "select * from "+ user_name + " order by kanpai_count desc;";
    var recv_data;

    var query = mysql_connecion.query(sql,[recv_data]);

    query.on('error',function(err) {
      console.log('err is: ',err);
    });

    query.on('result', function(rows) {
      console.log("user_name1 : " +  rows.user_name1);
      console.log("user_name2 : " +  rows.user_name2);
      console.log("kanpai_count : " +  rows.kanpai_count);
      console.log("lats_kanpai_time : " +  rows.last_kanpai_time);
      socket.emit("administrator_DBexpress", {name1:rows.user_name1,name2:rows.user_name2,count:rows.kanpai_count,time:rows.last_kanpai_time});
    });

    /*query.on('end', function() {
      console.log('end');
      mysql_connecion.destroy();
    });*/
  });

  /*切断したときに送信*/
  socket.on("disconnect", function () {
    io.sockets.emit("S_to_C_message", {value:"user disconnected"});
  });


});