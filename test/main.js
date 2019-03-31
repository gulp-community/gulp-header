const header = require('../');
const should = require('should');
const path = require('path');
const stream = require('stream');
const File = require('vinyl');
const gulp = require('gulp');
require('mocha');

const streamToString = stream =>
  new Promise((resolve, reject) => {
    try {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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
    const s = new stream.Readable({ objectMode: true });
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
    it('file should pass through', (done) => {
      let file_count = 0;
      const stream = header();
      stream.on('data', (newFile) => {
        should.exist(newFile);
        should.exist(newFile.path);
        should.exist(newFile.relative);
        should.exist(newFile.contents);
        newFile.path.should.equal('test/fixture/file.txt'.split('/').join(path.sep));
        newFile.relative.should.equal('file.txt');
        newFile.contents.toString('utf8').should.equal('Hello world');
        ++file_count;
      });

      stream.once('end', () => {
        file_count.should.equal(1);
        done();
      });

      stream.write(fakeFile);
      stream.end();
    });

    it('should prepend the header to the file content', (done) => {
      const myHeader = header('And then i said : ');

      myHeader.write(fakeFile);

      myHeader.once('data', (file) => {
        should(file.isBuffer()).ok();
        should.exist(file.contents);
        file.contents.toString('utf8').should.equal('And then i said : Hello world');
        done();
      });
      myHeader.end();
    });

    it('should prepend the header to the file content (stream)', (done) => {
      const myHeader = header('And then i said : ');

      myHeader.write(getFakeFileReadStream());

      myHeader.once('data', async (file) => {
        should(file.isStream()).ok();
        const result = await streamToString(file.contents);
        result.should.equal('And then i said : Hello world');
        done();
      });
      myHeader.end();
    });

    it('should format the header', (done) => {
      const stream = header('And then <%= foo %> said : ', { foo: 'you' });
      //const stream = header('And then ${foo} said : ', { foo : 'you' } );
      stream.on('data', (newFile) => {
        should.exist(newFile.contents);
        newFile.contents.toString('utf8').should.equal('And then you said : Hello world');
      });
      stream.once('end', done);

      stream.write(fakeFile);
      stream.end();
    });

    it('should format the header (ES6 delimiters)', (done) => {
      const stream = header('And then ${foo} said : ', { foo: 'you' });
      stream.on('data', (newFile) => {
        should.exist(newFile.contents);
        newFile.contents.toString('utf8').should.equal('And then you said : Hello world');
      });
      stream.once('end', done);

      stream.write(fakeFile);
      stream.end();
    });

    it('should access to the current file', (done) => {
      const stream = header(['<%= file.relative %>', '<%= file.path %>', ''].join('\n'));
      stream.on('data', (newFile) => {
        should.exist(newFile.contents);
        newFile.contents
          .toString('utf8')
          .should.equal('file.txt\ntest/fixture/file.txt\nHello world'.split('/').join(path.sep));
      });
      stream.once('end', done);

      stream.write(fakeFile);
      stream.end();
    });

    it('should access the data of the current file', (done) => {
      const stream = header('<%= license %>\n');
      stream.on('data', (newFile) => {
        should.exist(newFile.contents);
        newFile.contents.toString('utf8').should.equal('WTFPL\nHello world');
      });
      stream.once('end', done);

      stream.write(getFakeFile('Hello world', { license: 'WTFPL' }));
      stream.end();
    });

    it('multiple files should pass through', (done) => {
      const headerText = 'use strict;',
        stream = gulp.src('./test/fixture/*.txt').pipe(header(headerText)),
        files = [];

      stream.on('error', done);
      stream.on('data', (file) => {
        file.contents.toString('utf8').should.startWith(headerText);
        files.push(file);
      });
      stream.on('end', () => {
        files.length.should.equal(2);
        done();
      });
    });

    it('no files are acceptable', (done) => {
      const headerText = 'use strict;',
        stream = gulp.src('./test/fixture/*.html').pipe(header(headerText)),
        files = [];

      stream.on('error', done);
      stream.on('data', (file) => {
        files.push(file);
      });
      stream.on('end', () => {
        files.length.should.equal(0);
        done();
      });
    });
  });
});
