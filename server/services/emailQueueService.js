const knex = require('../config/database');
const { sendMail } = require('./emailService');
const logger = require('../config/logger');

const POLL_INTERVAL = parseInt(process.env.EMAIL_QUEUE_POLL_MS) || 10000;
const BATCH_SIZE = 5;

let workerRunning = false;

/**
 * Add an email to the queue
 */
const enqueueEmail = async ({ to, cc, subject, html, text, attachments, maxAttempts = 3, checklistName, categoryName, locationName, departmentName }) => {
  const serializedAttachments = attachments
    ? JSON.stringify(attachments.map(a => ({
        filename: a.filename,
        content: a.content ? Buffer.from(a.content).toString('base64') : undefined,
        path: a.path,
        encoding: a.content ? 'base64' : undefined
      })))
    : null;

  const [id] = await knex('email_queue').insert({
    to,
    cc: cc || null,
    subject,
    html: html || null,
    text: text || null,
    attachments: serializedAttachments,
    max_attempts: maxAttempts,
    status: 'pending',
    checklist_name: checklistName || null,
    category_name: categoryName || null,
    location_name: locationName || null,
    department_name: departmentName || null
  });

  logger.info(`Email queued [id=${id}] to=${to} subject="${subject}"`);
  return id;
};

/**
 * Process a single queued email
 */
const processQueuedEmail = async (job) => {
  await knex('email_queue').where('id', job.id).update({ status: 'processing', updated_at: knex.fn.now() });

  try {
    let attachments;
    if (job.attachments) {
      const parsed = typeof job.attachments === 'string' ? JSON.parse(job.attachments) : job.attachments;
      attachments = parsed.map(a => ({
        filename: a.filename,
        content: a.content ? Buffer.from(a.content, 'base64') : undefined,
        path: a.path
      }));
    }

    await sendMail({
      to: job.to,
      cc: job.cc || undefined,
      subject: job.subject,
      html: job.html,
      text: job.text,
      attachments
    });

    await knex('email_queue').where('id', job.id).update({
      status: 'sent',
      sent_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });

    logger.info(`Email sent [id=${job.id}] to=${job.to}`);
  } catch (error) {
    const attempts = job.attempts + 1;
    const failed = attempts >= job.max_attempts;

    await knex('email_queue').where('id', job.id).update({
      status: failed ? 'failed' : 'pending',
      attempts,
      last_error: error.message,
      updated_at: knex.fn.now()
    });

    logger.error(`Email ${failed ? 'failed' : 'retry'} [id=${job.id}] attempt=${attempts}: ${error.message}`, { code: error.code, command: error.command, host: error.hostname || error.host, port: error.port, stack: error.stack });
  }
};

/**
 * Poll and process pending emails
 */
const processBatch = async () => {
  const jobs = await knex('email_queue')
    .where('status', 'pending')
    .where('scheduled_at', '<=', knex.fn.now())
    .orderBy('created_at', 'asc')
    .limit(BATCH_SIZE);

  for (const job of jobs) {
    await processQueuedEmail(job);
  }

  return jobs.length;
};

/**
 * Start the background email queue worker
 */
const startWorker = () => {
  if (workerRunning) return;
  workerRunning = true;

  const poll = async () => {
    if (!workerRunning) return;
    try {
      await processBatch();
    } catch (error) {
      logger.error('Email queue worker error:', error);
    }
    setTimeout(poll, POLL_INTERVAL);
  };

  poll();
};

const stopWorker = () => {
  workerRunning = false;
  logger.info('Email queue worker stopped');
};

module.exports = { enqueueEmail, startWorker, stopWorker, processBatch };
