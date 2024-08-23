// File copied from https://dev.azure.com/devdiv/Engineering/_git/MicroBuild?path=/src/NodeJS/Signing/SignFiles.js&_a=contents&version=GBmain

const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync
const tempSigningDir = path.join(process.env.AGENT_TEMPDIRECTORY, 'signing')

/**
 * Accepts a simple JS array, converts the array to JSON, then signs the files with DDSignFiles.
 * @param {Array} FilesArray - JS array of files to sign and the certs to sign them with.
 * @returns {number} exit code of DDSignFiles. 0 for success, non-zero for failure.
 */
function signFiles(FilesArray) {
    var filesToSign = prepareDDSignJson(FilesArray)
    console.debug(JSON.stringify(filesToSign, null, "   "))
    writeFilesToSignToDisk(filesToSign)
    return runDDSignFiles()
}

/**
 * Converts a JS array to JSON for DDSignFiles
 * @param {Array} array - JS array of files to sign and the certs to sign them with.
 * @returns The contents of the JS array transformed into a JSON object format for DDSignFiles.
 */
function prepareDDSignJson(array) {
    var filesToSign = {
        "SignFileRecordList": []
    }

    for (var cert in array) {
        var innerJson = {
            "SignFileList": [],
            "Certs": cert
        }

        array[cert].forEach(function (file) {
            var paths = {
                "SrcPath": file,
                "DstPath": null // DDSignFiles converts null to SrcPath.
            }
            innerJson.SignFileList.push(paths)
        })
        filesToSign.SignFileRecordList.push(innerJson)
    }
    return filesToSign
}


/**
 * Writes the JSON to a file on disk. DDSignFiles needs to read a file.
 * @param {object} filesToSign - json content to write to disk.
 */
function writeFilesToSignToDisk(filesToSign) {
    try {
        var jsonFile = path.join(tempSigningDir, 'FilesToSign.json')

        if (!fs.existsSync(tempSigningDir)) {
            fs.mkdirSync(tempSigningDir)
        }

        fs.writeFileSync(jsonFile, JSON.stringify(filesToSign, null))
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.error("Error code suggests a file or directory could not be found. Are you writing to a directory that does not exist?")
        }
        console.error('See https://nodejs.org/api/errors.html#common-system-errors for more information and contact BarsD@microsoft.com for assistance.')
        console.error(e)
    }
}

/**
 * Runs the DDSignFiles tool for the files to sign and returns the exit code.
 * @returns {number} exit code of DDSignFiles.
 */
function runDDSignFiles() {
    var binPath = path.join(process.env.MBSIGN_APPFOLDER, 'ddsignfiles.dll')
    var jsonFile = path.join(tempSigningDir, 'FilesToSign.json')
    console.info(`Running command: dotnet ${binPath}' /filelist:${jsonFile}`)

    try {
        execSync(`dotnet ${binPath} /filelist:${jsonFile}`, { stdio: "inherit" })
    }

    catch (error) {
        console.error(`DDSignFiles exited with error.status: ${error.status}`)
        console.error(error)
        return error.status
    }

    return 0
}

module.exports = signFiles
