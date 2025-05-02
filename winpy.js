const util = require("util");
const exec = util.promisify(require("child_process").exec);
const target_ip = '192.168.244.160'
async function command() {
  const { stdout, stderr } = await exec(
    `docker context create arenpc --docker host=tcp://${target_ip}:2375`
  );
  console.log("stdout:", stdout);
  console.log("stderr:", stderr);
}
async function command2() {
  const { stdout, stderr } = await exec(`docker context use arenpc`);
  console.log("stdout:", stdout);
  console.log("stderr:", stderr);
}
command();
command2();