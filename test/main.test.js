import test, { beforeEach } from 'node:test';
import path from 'path';
import * as nodeStream from 'stream';
import { once } from 'node:events';
import { expect } from 'chai';
import File from 'vinyl';
import gulp from 'gulp';
import header from '../src/index.js';

const describe = test;
const it = test;

const streamToString = st =>
  new Promise((resolve, reject) => {
    try {
      const chunks = [];
      st.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      st.on('error', reject);
      st.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    } catch (err) {
      reject(err);
    }
  });

describe('gulp-header', () => {
  let fakeFile;

  const getFakeFile = (fileContent, data) => {
    const result = new File({
      path: './test/fixture/file.txt',
      cwd: './test/',
      base: './test/fixture/',
      contents: Buffer.from(fileContent || ''),
    });
    if (data !== undefined) {
      result.data = data;
    }
    return result;
  };

  const getFakeFileReadStream = () => {
    const s = new nodeStream.Readable({ objectMode: true });
    s._read = () => {};
    s.push('Hello world');
    s.push(null);
    return new File({
      contents: s,
      path: './test/fixture/anotherFile.txt',
    });
  };

  beforeEach(() => {
    fakeFile = getFakeFile('Hello world');
  });

  describe('header', () => {
    it('file should pass through', async () => {
      let file_count = 0;
      let assertions = 0;
      const s = header();
      s.on('data', newFile => {
        expect(newFile).to.exist;
        expect(newFile.path).to.exist;
        expect(newFile.relative).to.exist;
        expect(newFile.contents).to.exist;
        expect(newFile.path).to.equal('test/fixture/file.txt'.split('/').join(path.sep));
        expect(newFile.relative).to.equal('file.txt');
        expect(newFile.contents.toString('utf8')).to.equal('Hello world');
        ++file_count;
        assertions += 7;
      });

      s.write(fakeFile);
      s.end();

      await once(s, 'end');
      expect(file_count).to.equal(1);
      assertions += 1;
      expect(assertions).to.equal(8);
    });

    it('shouldprepend the header to the file content', async () => {
      const myHeader = header('And then i said : ');

      let assertions = 0;

      myHeader.write(fakeFile);

      const [file] = await once(myHeader, 'data');
      expect(file.isBuffer()).to.be.true;
      assertions++;
      expect(file.contents).to.exist;
      assertions++;
      expect(file.contents.toString('utf8')).to.equal('And then i said : Hello world');
      assertions++;
      myHeader.end();
      expect(assertions).to.equal(3);
    });

    it('should prepend the header to the file content (stream)', async () => {
      const myHeader = header('And then i said : ');

      let assertions = 0;

      myHeader.write(getFakeFileReadStream());

      const [file] = await once(myHeader, 'data');
      expect(file.isStream()).to.be.true;
      assertions++;
      const result = await streamToString(file.contents);
      expect(result).to.equal('And then i said : Hello world');
      assertions++;
      myHeader.end();
      expect(assertions).to.equal(2);
    });

    it('should format the header', async () => {
      const s = header('And then <%= foo %> said : ', { foo: 'you' });
      const results = [];
      let assertions = 0;
      s.on('data', newFile => {
        expect(newFile.contents).to.exist;
        assertions++;
        expect(newFile.contents.toString('utf8')).to.equal('And then you said : Hello world');
        assertions++;
        results.push(newFile);
      });

      s.write(fakeFile);
      s.end();
      await once(s, 'end');
      expect(results.length).to.be.greaterThan(0);
      // two assertions in data
      expect(assertions).to.equal(2);
    });

    it('should format the header (ES6 delimiters)', async () => {
      const s = header('And then ${foo} said : ', { foo: 'you' });
      const results = [];
      let assertions = 0;
      s.on('data', newFile => {
        expect(newFile.contents).to.exist;
        assertions++;
        expect(newFile.contents.toString('utf8')).to.equal('And then you said : Hello world');
        assertions++;
        results.push(newFile);
      });

      s.write(fakeFile);
      s.end();
      await once(s, 'end');
      expect(results.length).to.be.greaterThan(0);
      expect(assertions).to.equal(2);
    });

    it('should access to the current file', async () => {
      const expectedContents = 'file.txt\ntest/fixture/file.txt\nHello world'
        .split('/')
        .join(path.sep);
      const s = header(['<%= file.relative %>', '<%= file.path %>', ''].join('\n'));
      const results = [];
      let assertions = 0;
      s.on('data', newFile => {
        expect(newFile.contents).to.exist;
        assertions++;
        expect(newFile.contents.toString('utf8')).to.equal(expectedContents);
        assertions++;
        results.push(newFile);
      });

      s.write(fakeFile);
      s.end();
      await once(s, 'end');
      expect(results.length).to.be.greaterThan(0);
      expect(assertions).to.equal(2);
    });

    it('should access the data of the current file', async () => {
      const s = header('<%= license %>\n');
      const results = [];
      let assertions = 0;
      s.on('data', newFile => {
        expect(newFile.contents).to.exist;
        assertions++;
        expect(newFile.contents.toString('utf8')).to.equal('WTFPL\nHello world');
        assertions++;
        results.push(newFile);
      });

      s.write(getFakeFile('Hello world', { license: 'WTFPL' }));
      s.end();
      await once(s, 'end');
      expect(results.length).to.be.greaterThan(0);
      expect(assertions).to.equal(2);
    });

    it('multiple files should pass through', async () => {
      const headerText = 'use strict;';
      const s = gulp.src('./test/fixture/*.txt').pipe(header(headerText));
      const files = [];
      let assertions = 0;
      await new Promise((resolve, reject) => {
        s.on('error', reject);
        s.on('data', file => {
          expect(file.contents.toString('utf8')).to.match(/^use strict;/);
          assertions++;
          files.push(file);
        });
        s.on('end', () => resolve());
      });

      expect(files.length).to.equal(2);
      // two data assertions + one final length assertion
      assertions++;
      expect(assertions).to.equal(3);
    });

    it('no files are acceptable', async () => {
      const headerText = 'use strict;';
      const s = gulp.src('./test/fixture/*.html').pipe(header(headerText));
      const files = [];
      let assertions = 0;
      await new Promise((resolve, reject) => {
        s.on('error', reject);
        s.on('data', file => {
          files.push(file);
        });
        s.on('end', () => resolve());
      });

      expect(files.length).to.equal(0);
      assertions++;
      expect(assertions).to.equal(1);
    });
  });
});
