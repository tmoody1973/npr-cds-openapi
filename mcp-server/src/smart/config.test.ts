import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readHomeStation, saveHomeStation, smartInstructions } from './config';

const dir = () => path.join(mkdtempSync(path.join(tmpdir(), 'cds-config-')), 'nested');

test('env var wins over the saved config', () => {
  const d = dir();
  saveHomeStation('s921', d);
  assert.equal(readHomeStation({ NPR_CDS_HOME_STATION: 's55' }, d), 's55');
});

test('saved config is used when the env var is absent, and the file is private', () => {
  const d = dir();
  saveHomeStation('s921', d);
  assert.equal(readHomeStation({}, d), 's921');
  assert.equal(JSON.parse(readFileSync(path.join(d, 'config.json'), 'utf8')).homeStation, 's921');
  assert.equal(statSync(path.join(d, 'config.json')).mode & 0o777, 0o600);
});

test('no env and no file means undefined, not a crash', () => {
  assert.equal(readHomeStation({}, dir()), undefined);
});

test('smartInstructions names the home station when one is set', () => {
  const d = dir();
  saveHomeStation('s921', d);
  assert.equal(
    smartInstructions({}, d),
    'Home station: s921. Words like story, episode, newscast, show, podcast mean NPR CDS content: use find_stories first (name the station for local content), then read_story. Use coverage_scan for "who in the network covered X" questions.',
  );
});

test('smartInstructions drops the home-station sentence when none is set', () => {
  assert.equal(
    smartInstructions({}, dir()),
    'Words like story, episode, newscast, show, podcast mean NPR CDS content: use find_stories first (name the station for local content), then read_story. Use coverage_scan for "who in the network covered X" questions.',
  );
});
