const AuditLog = require('../models/AuditLog');

const execPreSave = (doc) => doc.$__schema.s.hooks.execPre('save', doc);

describe('AuditLog save middleware', () => {
  it('allows new entries and blocks updates as immutable', async () => {
    const newEntry = new AuditLog({
      actorRole: 'super_admin',
      action: 'college.create',
    });

    await expect(execPreSave(newEntry)).resolves.toBeUndefined();

    const existingEntry = new AuditLog({
      actorRole: 'super_admin',
      action: 'college.create',
    });
    existingEntry.$isNew = false;

    await expect(execPreSave(existingEntry)).rejects.toThrow(
      'Audit log entries are immutable and cannot be updated.'
    );
  });
});
