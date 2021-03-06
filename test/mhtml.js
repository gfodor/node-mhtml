
var should = require('should');
var fs = require('fs-extra');
var mhtml = require(__dirname + '/../mhtml');
var hat = require('hat');

var sources = __dirname + '/examples/';
var tmpdir = __dirname + '/tmp/';

beforeEach(function (done) {
  fs.mkdirs(tmpdir, done);
});

afterEach(function (done) {
  fs.remove(tmpdir, done);
});

describe('Extraction', function () {

  it('should extract a single file', function (done) {
    mhtml.extract(sources + 'example1.mhtml', tmpdir, false, false, false, function (err) {
      var extracted1 = fs.readdirSync(tmpdir);
      var extracted2 = fs.readdirSync(tmpdir + 'img');
      extracted1.should.eql(['example.css', 'example.html', 'img']);
      extracted2.should.eql(['bench.jpg', 'flower.jpg', 'good-example.jpg']);
      done();
    });
  });

  it('should extract etsy.com', function (done) {
    mhtml.extract(sources + 'etsy.mhtml', tmpdir, false, false, false, function (err) {
      var extracted1 = fs.readdirSync(tmpdir + "http:");
      extracted1.should.eql(['www.etsy.com']);

      done();
    });
  });

  it('should extract etsy.com including external assets', function (done) {
    mhtml.extract(sources + 'etsy.mhtml', tmpdir, false, true, false, function (err, primaryContentPath, primaryContentUrl) {
      primaryContentUrl.should.eql("http://www.etsy.com/search?q=scarf&view_type=gallery&ship_to=US");
      primaryContentPath.indexOf("http:/www.etsy.com/search?q=scarf&view_type=gallery&ship_to=US").should.be.above(-1)
      var extracted1 = fs.readdirSync(tmpdir + "http:");
      extracted1.should.eql(['img0.etsystatic.com', 'img1.etsystatic.com', 'site.etsystatic.com', 'www.etsy.com']);

      done();
    });
  });

  it('should extract microsoft.com despite long filenames with meta', function (done) {
    mhtml.extract(sources + 'microsoft.mhtml', tmpdir, false, true, true, function (err, primaryContentPath, primaryContentUrl) {
      primaryContentUrl.should.eql("http://www.microsoft.com/en-us/default.aspx");
      var extracted1 = fs.readdirSync(tmpdir + "http:");
      var extracted2 = fs.readdirSync(tmpdir + 'http:/c.s-microsoft.com/en-us/CMSStyles');
      extracted2.length.should.be.above(0)
      extracted1.should.eql(["c.s-microsoft.com", "i.microsoft.com", "i.s-microsoft.com", "www.microsoft.com"]);

      done();
    }, false, true, true);
  });

  it('should extract cnn.com even though not at index.html', function (done) {
    mhtml.extract(sources + 'cnn.mhtml', tmpdir, false, true, true, function (err, primaryContentPath, primaryContentUrl) {
      primaryContentUrl.should.eql("http://www.cnn.com/");
      var extracted1 = fs.readdirSync(tmpdir + "http:/www.cnn.com");
      extracted1.length.should.be.above(0)

      done();
    }, false, true, true);
  });

  it('should create any non-existing output folders', function (done) {
    mhtml.extract(sources + 'example1.mhtml', tmpdir + 'one/two/three', false, false, false, function (err) {
      var basedir = fs.readdirSync(tmpdir);
      var outputdir1 = fs.readdirSync(tmpdir + 'one/two/three');
      var outputdir2 = fs.readdirSync(tmpdir + 'one/two/three/img');
      basedir.should.eql(['one']);
      outputdir1.should.eql(['example.css', 'example.html', 'img']);
      outputdir2.should.eql(['bench.jpg', 'flower.jpg', 'good-example.jpg']);
      done();
    });
  });

  it('should leave any other files in the output folder alone', function (done) {

    fs.copySync(sources + 'foo.txt', tmpdir + 'foo.txt');

    mhtml.extract(sources + 'example1.mhtml', tmpdir, false, false, false, function (err) {
      var extracted1 = fs.readdirSync(tmpdir);
      var extracted2 = fs.readdirSync(tmpdir + 'img');
      extracted1.should.eql(['example.css', 'example.html', 'foo.txt', 'img']);
      extracted2.should.eql(['bench.jpg', 'flower.jpg', 'good-example.jpg']);
      done();
    });
  });

  it('should clean up the output folder when the "force" option is passed', function (done) {

    fs.copySync(sources + 'foo.txt', tmpdir + 'foo.txt');

    mhtml.extract(sources + 'example1.mhtml', tmpdir, true, false, false, function (err) {
      var extracted1 = fs.readdirSync(tmpdir);
      var extracted2 = fs.readdirSync(tmpdir + 'img');
      extracted1.should.eql(['example.css', 'example.html', 'img']);
      extracted2.should.eql(['bench.jpg', 'flower.jpg', 'good-example.jpg']);
      done();
    });
  });

  it('should convert internal links / srcs to be relative', function (done) {
    mhtml.extract(sources + 'example1.mhtml', tmpdir, false, false, false, function (err) {
      var html = fs.readFileSync(tmpdir + 'example.html', 'utf8');
      html.should.include('<a href="http://example.org/">Example External Link</a>', 'External links should be left alone');
      html.should.include('<img src="http://example.org/example.jpg" alt="Example External Image">', 'External images should be left alone');
      html.should.include('<a href="img/bench.jpg"><img src="img/bench.jpg" alt="bench"></a>', 'The internal link and image src should have been converted')
      html.should.not.include('file:/', 'No absolute file paths please')
      done();
    });
  });

  it('should auto-name parts that have no Content-Location', function (done) {
    mhtml.extract(sources + 'example3.mhtml', tmpdir, false, false, false, function (err) {
      var extracted = fs.readdirSync(tmpdir);
      extracted.should.have.length(4);
      extracted.forEach(function (file) {
        file.should.match(/^\d+\.(css|jpg|html)$/)
      });
      done();
    });
  });

  describe('Office 2010 Support', function () {

    it('Word', function (done) {
      mhtml.extract(sources + 'office2010/word.mht', tmpdir, false, false, false, function (err) {
        var extracted1 = fs.readdirSync(tmpdir);
        var extracted2 = fs.readdirSync(tmpdir + 'word_files');
        extracted1.should.eql(['word.htm', 'word_files']);
        extracted2.should.eql([
          'colorschememapping.xml',
          'filelist.xml',
          'image001.png',
          'image002.png',
          'image003.png',
          'image004.png',
          'oledata.mso',
          'themedata.thmx'
        ]);
        done();
      });
    });

    it('Excel', function (done) {
      mhtml.extract(sources + 'office2010/excel.mht', tmpdir, false, false, false, function (err) {
        var extracted1 = fs.readdirSync(tmpdir);
        var extracted2 = fs.readdirSync(tmpdir + 'excel_files');
        var tabstrip = fs.readFileSync(tmpdir + 'excel_files/tabstrip.htm', 'utf8');
        extracted1.should.eql(['excel.htm', 'excel_files']);
        extracted2.should.eql([
          'filelist.xml',
          'image001.png',
          'image002.png',
          'image003.png',
          'image004.png',
          'sheet001.htm',
          'sheet002.htm',
          'sheet003.htm',
          'stylesheet.css',
          'tabstrip.htm'
        ]);
        tabstrip.should.not.match(/<base/, 'The <base> tag should have been stripped');
        done();
      });
    });
  });
});

describe('Errors', function () {

  it('should complain if an invalid file is given', function (done) {
    mhtml.extract(sources + 'foo.txt', tmpdir, false, false, false, function (err) {
      err.should.be.and.instanceOf(Error).and.have.property('message', 'Invalid MHTML file');
      fs.readdirSync(tmpdir).should.be.empty;
      done();
    })
  });
});
