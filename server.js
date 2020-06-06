// server.js
// where your node app starts
//////////////Note///////////////
//Finished on May12

// include modules
const express = require('express');

const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');


const sqlite3 = require("sqlite3").verbose();

// Actual table creation; only runs if "postcards.db" is not found or empty
// Does the database table exist?
const PostcardTable = new sqlite3.Database("./.data/sqlite.db");
let cmd =
  " SELECT name FROM sqlite_master WHERE type='table' AND name='PostcardTable' ";
PostcardTable.get(cmd, function(err, val) {
  console.log(err, val);
  if (val == undefined) {
    console.log("No database file - creating one");
    createPostcardDB();
  } else {
    console.log("Database file found");
  }
});

function createPostcardDB() {
  // explicitly declaring the rowIdNum protects rowids from changing if the
  // table is compacted; not an issue here, but good practice
  const cmd =
    "CREATE TABLE PostcardTable ( rowIdNum INTEGER PRIMARY KEY, image TEXT, color TEXT, font TEXT, message TEXT)";
  PostcardTable.run(cmd, function(err, val) {
    if (err) {
      console.log("Database creation failure", err.message);
    } else {
      console.log("Created database");
    }
  });
}

console.log(makeid(5));

let storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, __dirname + '/images')
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname)
  }
})
// let upload = multer({dest: __dirname+"/assets"});
let upload = multer({
  storage: storage
});

const FormData = require("form-data");
// begin constructing the server pipeline
const app = express();

// Serve static files out of public directory
app.use(express.static('public'));

// Also serve static files out of /images
app.use("/images", express.static('images'));

// Handle GET request to base URL with no other route specified
// by sending creator.html, the main page of the app
app.get("/", function(request, response) {
  response.sendFile(__dirname + '/public/creator.html');
});

// Next, the the two POST AJAX queries

// Handle a post request to upload an image.
app.post("/upload", upload.single("newImage"), function(request, response) {
  console.log(
    "Recieved",
    request.file.originalname,
    request.file.size,
    "bytes"
  );
  if (request.file) {
    // file is automatically stored in /images,
    // even though we can't see it.
    // We set this up when configuring multer
    sendMediaStore("/images/"+request.file.originalname, request, response);
    //response.end("recieved " + request.file.originalname);
  } else throw "error";
});

function sendMediaStore(filename, serverRequest, serverResponse) {
  let apiKey = process.env.ECS162KEY;
  if (apiKey === undefined) {
    serverResponse.status(400);
    serverResponse.send("No API key provided");
  } else {
    // we'll send the image from the server in a FormData object
    let form = new FormData();

    // we can stick other stuff in there too, like the apiKey
    form.append("apiKey", apiKey);
    // stick the image into the formdata object
    form.append("storeImage", fs.createReadStream(__dirname + filename));
    // and send it off to this URL
    form.submit("http://ecs162.org:3000/fileUploadToAPI", function(
      err,
      APIres
    ) {
      // did we get a response from the API server at all?
      if (APIres) {
        // OK we did
        console.log("API response status", APIres.statusCode);
        // the body arrives in chunks - how gruesome!
        // this is the kind stream handling that the body-parser
        // module handles for us in Express.
        let body = "";
        APIres.on("data", chunk => {
          body += chunk;
        });
        APIres.on("end", () => {
          // now we have the whole body
          if (APIres.statusCode != 200) {
            serverResponse.status(400); // bad request
            serverResponse.send(" Media server says: " + body);
          } else {
            serverResponse.status(200);
            serverResponse.send(body);
          }
          //delete files
          //fs.unlink(filename);
        });
      } else {
        // didn't get APIres at all
        serverResponse.status(500); // internal server error
        serverResponse.send("Media server seems to be down.");
      }
    });
  }
}

//Generate random id
//From: https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

// Handle a post request containing JSON
app.use(bodyParser.json());
// gets JSON data into req.body
app.post('/saveDisplay', function(req, res) {
  let id = makeid(22);
  let image = req.body.image;
  let color = req.body.color;
  let font = req.body.font;
  let message = req.body.message;
  let cmd = "INSERT INTO postcards (id, image, color, font, message) VALUES(?,?,?,?,?)";
  PostcardTable.run(cmd, id, image ,color , font , message, function (err) {
      if (err) {
        res.status(404).send('postcard not saved');
      } else {
        res.send(JSON.stringify({"id": id}))
      }
    });
});

//displayscript.js
app.post('/showPostcard', function(req, res) {
  let cmd = "SELECT * FROM postcards WHERE id=?";
  PostcardTable.get(cmd, [req.body.id], function (err, rows) {
    if (err) {
      console.log("Database reading error", err.message)
    } else {
      let rtable = {"image": rows.image,"color": rows.color,"font": rows.font,"message": rows.message,};
      res.send(JSON.stringify(rtable));
    }
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});