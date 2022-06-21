require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const socketIO = require("socket.io");

const { generateMessage, generateLocationMessage } = require("./utils/message");
const { isRealString } = require("./utils/isRealString");
const { Users } = require("./utils/users");
const fs = require("fs");

const publicPath = path.join(__dirname, "../public");
const port = process.env.PORT || 3000;
const hostname = process.env.HOSTNAME;
let app = express();
let server = http.createServer(app);
let io = socketIO(server);
let users = new Users();

app.use(express.static(publicPath));

io.on("connection", (socket) => {
  console.log("A new user just connected");

  socket.on("join", (params, callback) => {
    if (!isRealString(params.name) || !isRealString(params.room)) {
      return callback("Name and room are required");
    }

    socket.join(params.room);
    users.removeUser(socket.id);
    users.addUser(socket.id, params.name, params.room);

    io.to(params.room).emit("updateUsersList", users.getUserList(params.room));
    socket.emit(
      "newMessage",
      generateMessage("Admin", `Welocome to ${params.room}!`)
    );

    socket.broadcast
      .to(params.room)
      .emit(
        "newMessage",
        generateMessage("Admin", `${params.name}: New User Joined!`)
      );

    callback();
  });

  socket.on("createMessage", (message, callback) => {
    let user = users.getUser(socket.id);

    if (user && isRealString(message.text)) {
      io.to(user.room).emit(
        "newMessage",
        generateMessage(user.name, message.text)
      );
    }
    callback("This is the server:");
  });

  socket.on("createLocationMessage", (coords) => {
    let user = users.getUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        "newLocationMessage",
        generateLocationMessage(user.name, coords.lat, coords.lng)
      );
    }
  });

  socket.on("sendImage", (data) => {
    var guess = data.base64.match(/^data:image\/(png|jpeg);base64,/)[1];
    var ext = "";
    switch (guess) {
      case "png":
        ext = ".png";
        break;
      case "jpeg":
        ext = ".jpg";
        break;
      default:
        ext = ".bin";
        break;
    }

    var savedFilename = "/uploads/" + randomString(10) + ext;
    fs.writeFile(
      __dirname + "../public" + savedFilename,
      getBase64Image(data.base64),
      "base64",
      (err) => {
        if (err !== null) {
          console.log(err);
        } else {
          io.sockets.emit("receiveImage", {
            path: savedFilename,
          });
          console.log("Send Image Successfully");
        }
      }
    );
  });

  socket.on("disconnect", () => {
    let user = users.removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("updateUsersList", users.getUserList(user.room));
      io.to(user.room).emit(
        "newMessage",
        generateMessage(
          "Admin",
          `${user.name} has left ${user.room} chat room.`
        )
      );
    }
  });
});

function randomString(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-dwweed_";
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

function getBase64Image(imgData) {
  return imgData.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
}

server.listen(port, hostname, () => {
  console.log(`Server runnig at http://${hostname}:${port}`);
});
