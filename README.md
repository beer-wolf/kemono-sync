## Kemono Sync

A script to download creators from kemono.su via the official API. 

The script supports continuous download, where on re-launch it only downloads missing files if launched in the same directory.


## Usage

Just launch the download.js file with `node downloads.js` after installing the requirements with `node i`.

There is one mandatory parameter: the id of the creator on kemono.su. You can get it from the url; just copy the numbers from there: `https://kemono.su/patreon/user/{id}`.

You must pass it as follows: `node downloads.js -i {your_id_here}`.

There are also three more optional parameters:

- `-p` specifies the platform of downloads (patreon if not specified). You can get it from the part of the url between `kemono.su/` and `/user`: `https://kemono.su/{platform}/user/{id}`.
- `-d` specifies the target directory for the files to be downloaded to. By default, creates a new directory `downloads` at the current path.
- `n` specifies the number of parallel downloads. Downloading too fast will trigger multiple 429 errors, so leaving this parameter as the default is advised.


## Known issues

As of now, when the generated file name is too long, it won't be saved on Windows (long path related issue).