#!/usr/bin/env node

const { statSync, createReadStream, createWriteStream } = require('fs')
const prettyBytes = require('pretty-bytes')
const progress = require('progress-stream')
const JSONStream = require('JSONStream')
const getSize = require('package-size')
const miss = require('mississippi')
const nodeify = require('nodeify')
const map = require('lodash.map')
const path = require('path')
const ora = require('ora')

const spinner = ora('').start()
let progressPercentage = 0
let pkgName = ''
let count = 0

const filepath = path.resolve('node_modules/all-the-package-names/names.json')
const read = createReadStream(filepath)
const write = createWriteStream('./index.json')
const parse = JSONStream.parse('*')
const stringify = JSONStream.stringify('[', ',\n', ']\n', 2)

const getPackageSize = miss.through.obj(function (chunk, enc, cb) {
  pkgName = chunk.toString()
  spinner.text = `processing ${pkgName}... ${count} in total (${progressPercentage}%)`
  ++count

  nodeify(getSize(pkgName), function (err, data) {
    // TODO: A package fails because needs to install deps into a temporal folder.
    // See https://github.com/pastelsky/npm-cost/blob/master/src/server.js#L257
    if (err) {
      console.warn('impossible to process', pkgName)
      return cb(null)
    }
    const { name, versionedName, size, minified, gzipped } = data
    const raw = { size, minified, gzipped }
    const pretty = map(raw, (value, key) => ({ [key]: prettyBytes(value) }))
    return cb(null, { name, versionedName, raw, pretty })
  })
})

const stats = progress({
  length: statSync(filepath).size,
  time: 100
})

stats.on('progress', function (progress) {
  progressPercentage = Math.round(progress.percentage)
})

miss.pipe(read, stats, parse, getPackageSize, stringify, write, function (err) {
  if (err) throw err
  spinner.text = `${count} in total (100%)`
  process.exit()
})
