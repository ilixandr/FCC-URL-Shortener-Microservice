'use strict';
const express = require('express');
const mongo = require('mongodb');
const mongoose = require('mongoose');
const cors = require('cors');
/* declare body parser */
const bodyParser = require('body-parser');
const app = express();
const dns = require('dns');
// Basic Configuration 
const port = process.env.PORT || 3000;
/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true});

app.use(cors());
/* use body parser */
app.use(bodyParser.urlencoded({'extended': false}));
/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', (req, res) => res.sendFile(process.cwd() + '/views/index.html'));
  
// your first API endpoint... 
app.get("/api/hello", (req, res) => res.json({greeting: 'hello API'}));

/* My code starts here */
/* some helper functions */
const validLink = /^https?:\/\/(.*)/i; /* RegExp for simple http(s) links (e.g. https://google.com) */
const validBiggerLink = /^([\w\d\-_]+\.)+[\w\d\-_]+/i; /* RegExp for complex links (e.g. https://blog.example.com), to extract domain for DNS validation */

const increaseIndex = (req, res, done) => {
  Indexes.findOneAndUpdate({}, {$inc:{'count': 1}}, (err, data) => {
      if (err) {
        return done(err);
      } else {
        if (data) {
          done(data.count);
        } else {
            const newIndex = new Indexes();
            newIndex.save((err) => {
              if (err) return done(err);
              Indexes.findOneAndUpdate({}, {$inc:{'count': 1}},(err, data) => err ? done(err) : done(data.count));
            });
        }
      }
  });
}

const addNewUrl = (req, res) => {
  let url = req.body.url;
  /* remove trailing slashes (/) from urls */
  if (url.match(/\/$/i)) {
    url = url.slice(0,-1);
  }
  const matchedLink = url.match(validLink);
  if (!matchedLink) {
    return res.json({"error": "Invalid URL"});
  }
  /* match returns an array https://google.com => ["https://google.com", "google.com"] */
  const noProtocolLink = matchedLink[1];
  /* extract the hostname */
  const hostLink = noProtocolLink.match(validBiggerLink);
  if (hostLink) {
    /* DNS lookup for host domain */
    dns.lookup(hostLink[0], (err) => {
      if (err) {
        res.json({"error": "Invalid URL"});
      } else {
        Urls.findOne({"url": url}, (err, data)  => {
            if (err) return err;
            if (data) {
              /* URL already known? Inform user. */
              res.json({"original_url": url, "short_url": data.code});
            } else {
              /* new URL */
              increaseIndex(req, res, (code) => {
                const newUrlEntry = new Urls({"url": url, "code": code});
                newUrlEntry.save((err) => {
                  if (err) {
                    return err;
                  }
                  res.json({"original_url": url, "short_url": code});
                });
              });
            }
          });
        }
      });
    } else {
      res.json({"error": "Invalid URL"});
    }
  }

const readShortUrl = (req, res) => {
  const shorturl = req.params.shorturl;
  if (!parseInt(shorturl)) {
    res.json({"error":"Unknown short url"});
      return 1;
  }
  Urls.findOne({"code": shorturl}, (err, data) => {
    if (err) return err;
    if (data){
      res.redirect(data.url);
    } else {
      res.json({"error":"No URL found"});
    }
  });
}

/*
first, connect mongooose 
see line 10 for details
*/
/* now, let's define schemas */
const Schema = mongoose.Schema;
const IndexesSchema = new Schema({count : {type: Number, default: 1}});
const UrlsSchema = new Schema({url: {type: String, required: true}, code: {type: Number, required: true}});
/* models are next */
const Indexes = mongoose.model("Indexes", IndexesSchema);
const Urls = mongoose.model("Urls", UrlsSchema);

app.post("/api/shorturl/new", addNewUrl);
  
app.get('/api/shorturl/:shorturl', readShortUrl);


app.listen(port, () => console.log('Node.js listening ...'));
