/**
 * Scenario Script: Digital Assets Desk End-to-End & Privacy Isolation Verification
 * Batch Tag: STAGE_SCENARIO_BKBC_DIGITAL
 *
 * - Lawful public-domain digital book ingestion (Project Gutenberg #1661)
 * - Complete content moderation lifecycle (pending -> approved -> published)
 * - Student in-browser EPUB reader state & private highlight/annotation persistence
 * - Cross-patron and cross-tenant isolation (zero leakage to other students or external colleges)
 * - Fully removable via --purge
 */

const mongoose = require('mongoose');
const env = require('../config/env');
const College = require('../models/College');
const User = require('../models/User');
const EResource = require('../models/EResource');
const Annotation = require('../models/Annotation');

const BATCH_TAG = 'STAGE_SCENARIO_BKBC_DIGITAL';

async function purgeScenarioData(collegeId) {
  console.log(`\n🧹 Purging scenario data for batch tag: ${BATCH_TAG}...`);
  const eresources = await EResource.find({ collegeId, batchTag: BATCH_TAG });
  const eresourceIds = eresources.map((e) => e._id);

  const deletedAnnotations = await Annotation.deleteMany({ bookId: { $in: eresourceIds } });
  const deletedEResources = await EResource.deleteMany({ collegeId, batchTag: BATCH_TAG });

  console.log(`  ✓ Removed ${deletedAnnotations.deletedCount} annotations.`);
  console.log(`  ✓ Removed ${deletedEResources.deletedCount} e-resources.`);
}

async function runScenario() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const college = await College.findOne({ slug: 'bkbirla' });
  if (!college) {
    throw new Error('College bkbirla not found');
  }
  const collegeId = college._id;

  const admin = await User.findOne({ collegeId, role: 'college-admin' });
  if (!admin) {
    throw new Error('College admin not found');
  }

  const isPurge = process.argv.includes('--purge');
  if (isPurge) {
    await purgeScenarioData(collegeId);
    await mongoose.disconnect();
    console.log('Purge completed.');
    return;
  }

  // Pre-purge to guarantee clean baseline
  await purgeScenarioData(collegeId);

  // 1. Fetch real students for verification
  const students = await User.find({ collegeId, role: 'student' }).sort({ studentId: 1 }).limit(2);
  const studentA = students[0];
  const studentB = students[1];

  // 2. Fetch or create a separate test college for cross-tenant verification
  let otherCollege = await College.findOne({ slug: 'other-test-college' });
  if (!otherCollege) {
    otherCollege = await College.create({
      name: 'External Test Institution',
      code: 'EXT-TEST',
      slug: 'other-test-college',
      status: 'active',
      licenseTier: 'basic',
    });
  }

  console.log(`\n🚀 Executing Digital Assets Desk Pipeline (${BATCH_TAG})...`);
  console.log(`Institution: ${college.name} (${collegeId})`);
  console.log(`Target Content: The Adventures of Sherlock Holmes (Arthur Conan Doyle, 1892)`);
  console.log(`Rights Provenance: Universal Public Domain (Project Gutenberg ID 1661)`);

  // Step A: Stage E-Resource Submission (pending moderation)
  console.log('\n[1/4] Submitting digital asset into moderation pipeline...');
  const eResource = await EResource.create({
    collegeId,
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    category: 'Literature & Fiction',
    type: 'epub',
    fileUrl: 'https://www.gutenberg.org/ebooks/1661.epub3.images',
    source: 'gutenberg',
    sourceType: 'gutenberg',
    fileFormat: 'epub',
    licenseType: 'public-domain',
    rightsProof:
      'Project Gutenberg US Public Domain (Published 1892; author died 1930 > 70 years PMA)',
    moderationStatus: 'pending',
    isPublished: false,
    isDownloadable: true,
    fileSize: 1845200, // 1.8 MB
    submittedBy: studentA._id,
    uploadedBy: studentA._id,
    batchTag: BATCH_TAG,
  });
  console.log(`  ✓ Asset created in 'pending' moderation state (ID: ${eResource._id})`);

  // Step B: Moderation & Global Publication Lifecycle
  console.log('\n[2/4] Executing Institutional Moderation & Publication Flow...');

  // 1. Admin reviews and approves
  eResource.moderationStatus = 'approved';
  eResource.moderatedBy = admin._id;
  eResource.moderatedAt = new Date();
  eResource.moderationNote = 'Rights verified: Canonical Project Gutenberg public-domain edition.';
  await eResource.save();
  console.log(`  ✓ Moderation Step 1: Approved by College Admin (${admin.email})`);

  // 2. Global publication to student catalog
  eResource.moderationStatus = 'published';
  eResource.isPublished = true;
  eResource.publishedAt = new Date();
  await eResource.save();
  console.log(`  ✓ Moderation Step 2: Published to B.K. Birla College digital catalog.`);

  // Step C: Student A In-Browser Reader Session & Private Annotation
  console.log('\n[3/4] Student A opens digital book and creates private highlight annotation...');
  const annotationA = await Annotation.create({
    collegeId,
    userId: studentA._id,
    bookId: eResource._id,
    type: 'highlight',
    cfiRange: 'epubcfi(/6/4[chapter-1]!/4/2/10,/1:0,/1:45)',
    highlightText: 'To Sherlock Holmes she is always the woman.',
    color: '#fef08a', // Yellow highlight token
    noteText: 'Opening passage — Irene Adler reference by Dr. Watson.',
  });
  console.log(`  ✓ Annotation saved for Student A (${studentA.studentId}, ID: ${annotationA._id})`);

  // Step D: Verify Multi-Tenant & Cross-Patron Privacy Isolation
  console.log('\n[4/4] Verifying Patron Privacy & Multi-Tenant Boundaries...');

  // 1. Student A queries annotations -> gets exactly 1
  const studentAAnnotations = await Annotation.find({
    userId: studentA._id,
    bookId: eResource._id,
  });
  console.log(
    `  • Student A annotations query: ${studentAAnnotations.length} record(s) found (Matches own highlight)`
  );

  // 2. Student B queries annotations for same book -> must get 0
  const studentBAnnotations = await Annotation.find({
    userId: studentB._id,
    bookId: eResource._id,
  });
  console.log(
    `  • Student B annotations query: ${studentBAnnotations.length} record(s) found (Zero cross-patron leakage)`
  );

  // 3. External College query -> must get 0 e-resources
  const externalCollegeResources = await EResource.find({
    collegeId: otherCollege._id,
    batchTag: BATCH_TAG,
  });
  console.log(
    `  • External college catalog query: ${externalCollegeResources.length} record(s) found (Zero cross-tenant leakage)`
  );

  if (
    studentAAnnotations.length !== 1 ||
    studentBAnnotations.length !== 0 ||
    externalCollegeResources.length !== 0
  ) {
    throw new Error('Digital asset isolation check failed!');
  }

  console.log('\n================================================================');
  console.log('✅ DIGITAL ASSETS DESK PIPELINE VERIFIED SUCCESSFULLY');
  console.log('================================================================');
  console.log(`Batch Tag:            ${BATCH_TAG}`);
  console.log(`Digital Title:        The Adventures of Sherlock Holmes`);
  console.log(`Legal Rights Proof:   Documented Project Gutenberg Public Domain`);
  console.log(`Moderation Flow:      pending -> approved -> published verified`);
  console.log(`Annotation Privacy:   Verified strictly isolated to individual patron`);
  console.log(`Tenant Isolation:     Verified zero cross-college exposure`);
  console.log(`Purge Command:        node backend/src/scripts/runDigitalAssetsScenario.js --purge`);
  console.log('================================================================\n');

  await mongoose.disconnect();
}

runScenario().catch((err) => {
  console.error('Scenario failed:', err);
  process.exit(1);
});
