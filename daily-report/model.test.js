const assert = require('assert');
const path = require('path');
const model = require(path.join(__dirname, 'model.js'));

const report = model.emptyReport('user-1');
assert.ok(report.id);
assert.strictEqual(report.userId, 'user-1');
assert.strictEqual(report.status, 'draft');
assert.ok(report.reportDate);
assert.ok(Array.isArray(report.crew));
assert.ok(report.crew[0].id);

report.jobName = 'Highway 99 mill';
report.jobNumber = 'J-1042';
report.weather = 'Rain';
report.crew = [{ name: 'Alex', role: 'Foreman', hours: '8' }, { name: '', role: '', hours: '' }];
report.materials = [{ name: 'Cold patch', qty: '4', unit: 'ton', notes: '' }];
report.equipment = [{ name: 'Roller', hours: '6', notes: '' }];

const normalized = model.normalizeReport(report, 'user-1');
assert.strictEqual(normalized.crew.length, 1);
assert.strictEqual(model.reportTitle(normalized), 'Highway 99 mill #J-1042');

const summary = model.reportToSummaryRow(normalized);
assert.strictEqual(summary.jobNumber, 'J-1042');
assert.strictEqual(summary.weather, 'Rain');

const fromSheet = model.reportsFromSheetRows([summary]);
const withKids = model.attachChildRows(
  fromSheet,
  model.crewRows(normalized),
  model.materialRows(normalized),
  model.equipmentRows(normalized)
);
assert.strictEqual(withKids[0].crew[0].name, 'Alex');
assert.strictEqual(withKids[0].materials[0].name, 'Cold patch');
assert.strictEqual(withKids[0].equipment[0].name, 'Roller');

console.log('daily-report model tests ok');
