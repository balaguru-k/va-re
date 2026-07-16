/**
 * Migration: Add vendor and engineer attachment fields
 */

exports.up = function(knex) {
  return knex.schema.table('tickets', function(table) {
    table.json('vendor_attachments').nullable().comment('JSON array of vendor attachment filenames');
    table.json('engineer_attachments').nullable().comment('JSON array of engineer attachment filenames');
  });
};

exports.down = function(knex) {
  return knex.schema.table('tickets', function(table) {
    table.dropColumn('vendor_attachments');
    table.dropColumn('engineer_attachments');
  });
};