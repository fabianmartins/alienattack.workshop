const fs = require("fs");

var cdkOutputs = {};

const outputresult = fs.readFileSync(`${__dirname}/cdkOutputs.txt`, {
  encoding: "utf-8"
});

const lines = outputresult.split("\n");
let line = 0;

for (line = lines.length; line > 0; line--) {
  if (lines[line] === "Outputs:") {
    line++;
    break;
  }
}

while (line < lines.length && lines[line] !== "") {
  var key = lines[line].split("=")[0].trim();
  key = key.split(".")[key.split(".").length - 1];
  cdkOutputs[key] = lines[line].split("=")[1].trim();
  line++;
}

const configText =
  "// This is an auto generated file. Any edits will be overwritten\nconst DEBUG = true;\nconst AWS_CONFIG = " +
  JSON.stringify(cdkOutputs);

fs.writeFile(
  "../alienattack.application/resources/js/awsconfig.js",
  configText,
  function(err) {
    if (err) throw err;
    console.log("config file saved!");
  }
);
