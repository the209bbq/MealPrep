import assert from 'node:assert/strict';
import {
  defaultTutorialProgress,
  markStepDone,
  markStepSkipped,
  resumeActiveIndex,
} from '../lib/onboarding/tutorialProgress';

function run() {
  const fresh = defaultTutorialProgress();
  assert.equal(resumeActiveIndex(fresh), 0);

  const afterScan = markStepDone(fresh, 'scan');
  assert.equal(afterScan.steps.scan, 'done');
  assert.equal(afterScan.activeIndex, 1);
  assert.equal(afterScan.taskInProgress, false);

  const skippedGrocery = markStepSkipped(afterScan, 'grocery');
  assert.equal(skippedGrocery.steps.grocery, 'skipped');
  assert.equal(skippedGrocery.activeIndex, 1);

  const afterRecipes = markStepDone(skippedGrocery, 'recipes');
  assert.equal(afterRecipes.activeIndex, 3);

  const afterShop = markStepDone(afterRecipes, 'shop');
  assert.equal(afterShop.activeIndex, 4);
  console.log('tutorial-progress-check: ok');
}

run();
