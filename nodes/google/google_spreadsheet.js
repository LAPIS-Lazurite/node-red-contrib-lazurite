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
	
	function init(node) {
		fs.readFile('/home/pi/.node-red/node_modules/node-red-contrib-lazurite/nodes/google/client_secret.json', function processClientSecrets(err, content) {
			if (err) {
				console.log('Error loading client secret file: ' + err);
				return;
			}
			// Authorize a client with the loaded credentials, then call the
			// Google Sheets API.
			node.credentials = JSON.parse(content);
			authorize(node);
		});
	}
	/**
	* Create an OAuth2 client with the given credentials, and then execute the
	* given callback function.
	*
	* @param {Object} credentials The authorization client credentials.
	* @param {function} callback The callback to call with the authorized client.
	*/
	function authorize(node) {
	//function authorize(credentials, callback) {
		var clientSecret = node.credentials.installed.client_secret;
		var clientId = node.credentials.installed.client_id;
		var redirectUrl = node.credentials.installed.redirect_uris[0];
		var auth = new googleAuth();
		node.oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

		// Check if we have previously stored a token.
		fs.readFile(TOKEN_PATH, function(err, token) {
		if (err) {
			getNewToken(node.oauth2Client, callback);
			//getNewToken(oauth2Client);
			} else {
			node.oauth2Client.credentials = JSON.parse(token);
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
	
	function append(node,data) {
		var sheets = google.sheets('v4');
		var range = (node.sheetName != "" ? node.sheetName + "!":"") +
			'A:'+String.fromCharCode("A".charCodeAt(0)+data.length);
		var msg = {
			auth: node.oauth2Client,
			spreadsheetId: node.sheetId,
			valueInputOption: 'RAW',
			range: range,
			insertDataOption: 'INSERT_ROWS',
			resource: {
				values:[data]
			}
		}
		sheets.spreadsheets.values.append(msg, function(err, response) {
			if (err) {
				console.log('The API returned an error: ' + err);
				return;
			}
		});
	}
	/**
	* Print the names and majors of students in a sample spreadsheet:
	* https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
	*/
	function send(node,data) {
		try {
			append(node,data);
		} catch(e) {
			init(node);
			append(node,data);
		}
	}
	function GoogleSpreadsheet(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		node.sheetId = config.sheetid;
		node.sheetName = config.sheetname;
		init(node);
		node.on('input', function (msg) {
			send(node,msg.payload);
		});
	}
	RED.nodes.registerType("google-spreadsheet", GoogleSpreadsheet);
}

