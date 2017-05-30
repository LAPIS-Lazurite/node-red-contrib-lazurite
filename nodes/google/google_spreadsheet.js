/**
 * Copyright 2017 Lapis Semiconducor Ltd,.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
	var initialized = false;
	var fs = require('fs');
	var readline = require('readline');
	var google = require('googleapis');
	var googleAuth = require('google-auth-library');
	// If modifying these scopes, delete your previously saved credentials
	// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
	var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
	var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    	process.env.USERPROFILE) + '/.credentials/';
	var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';
	var sheetId = "";
	var oauth2Client;
	
	function init() {
		fs.readFile('/home/pi/.node-red/node_modules/node-red-contrib-lazurite/nodes/google/client_secret.json', function processClientSecrets(err, content) {
			if (err) {
				console.log('Error loading client secret file: ' + err);
				return;
			}
			// Authorize a client with the loaded credentials, then call the
			// Google Sheets API.
			authorize(JSON.parse(content));
		});
	}
	/**
	* Create an OAuth2 client with the given credentials, and then execute the
	* given callback function.
	*
	* @param {Object} credentials The authorization client credentials.
	* @param {function} callback The callback to call with the authorized client.
	*/
	function authorize(credentials) {
	//function authorize(credentials, callback) {
		var clientSecret = credentials.installed.client_secret;
		var clientId = credentials.installed.client_id;
		var redirectUrl = credentials.installed.redirect_uris[0];
		var auth = new googleAuth();
		oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

		// Check if we have previously stored a token.
		fs.readFile(TOKEN_PATH, function(err, token) {
		if (err) {
			getNewToken(oauth2Client, callback);
			//getNewToken(oauth2Client);
			} else {
			oauth2Client.credentials = JSON.parse(token);
//			callback(oauth2Client);
			}
		});
	}
	// Load client secrets from a local file.
	/**
	* Get and store new token after prompting for user authorization, and then
	* execute the given callback with the authorized OAuth2 client.
	*
	* @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
	* @param {getEventsCallback} callback The callback to call with the authorized
	*     client.
	*/
	function getNewToken(oauth2Client) {
	//function getNewToken(oauth2Client, callback) {
		var authUrl = oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES
		});
		console.log('Authorize this app by visiting this url: ', authUrl);
		var rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		rl.question('Enter the code from that page here: ', function(code) {
			rl.close();
			oauth2Client.getToken(code, function(err, token) {
				if (err) {
					console.log('Error while trying to retrieve access token', err);
					return;
				}
				oauth2Client.credentials = token;
				storeToken(token);
				//callback(oauth2Client);
			});
		});
	}

	/**
	* Store token to disk be used in later program executions.
	*
	* @param {Object} token The token to store to disk.
	*/
	function storeToken(token) {
		try {
			fs.mkdirSync(TOKEN_DIR);
		} catch (err) {
			if (err.code != 'EEXIST') {
				throw err;
			}
		}
		fs.writeFile(TOKEN_PATH, JSON.stringify(token));
		console.log('Token stored to ' + TOKEN_PATH);
	}
	
	/**
	* Print the names and majors of students in a sample spreadsheet:
	* https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
	*/
	function send(data) {
		var sheets = google.sheets('v4');
		var range = 'A:'+String.fromCharCode("A".charCodeAt(0)+data.length);
		sheets.spreadsheets.values.append({
			auth: oauth2Client,
			spreadsheetId: sheetId,
			valueInputOption: 'RAW',
			range: range,
			insertDataOption: 'INSERT_ROWS',
			resource: {
				values:[data]
			}
		}, function(err, response) {
			if (err) {
				console.log('The API returned an error: ' + err);
				return;
			}
		});
	}
	function GoogleSpreadsheet(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		sheetId = config.sheetid;
		init();
		
		node.on('input', function (msg) {
			send(msg.payload);
		});
	}
	RED.nodes.registerType("google-spreadsheet", GoogleSpreadsheet);
}
