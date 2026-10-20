const crypto = require('node:crypto');

function imageReferences(env) {
  const { JOB_NAME, BUILD_NUMBER, GIT_COMMIT } = env;
  if (!JOB_NAME || !/^\d{1,20}$/.test(BUILD_NUMBER || '') || !/^[a-f0-9]{7,64}$/i.test(GIT_COMMIT || '')) {
    throw new Error('JOB_NAME, numeric BUILD_NUMBER, and GIT_COMMIT are required for release image tags.');
  }
  const namespace = crypto.createHash('sha256').update(env.JENKINS_URL || '').update('\0').update(JOB_NAME).digest('hex').slice(0, 24);
  const tag = `${namespace}-${BUILD_NUMBER}-${GIT_COMMIT.slice(0, 12).toLowerCase()}`;
  return ['backend', 'frontend'].map(component => `cloudbite-${component}:${tag}`);
}
if (require.main === module) {
  try { console.log(imageReferences(process.env).join('\n')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { imageReferences };
