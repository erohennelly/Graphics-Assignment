// image processing functions for Canvas imageData
//  - related to frame differencing operations
//  - also related to background-modelling
// Author: Sam Redfern, 2017

var cachedImageData = [];
var numImagesCached;

function heatmapTest1() {
	// create and display a 50-frame frame-differencing heatmap centering on frame 24
	cacheImages(0,49,function() { // cacheImages is asynchronous
		makeAndDisplayHeatmap(0,49);
	}); 
}

function makeAndDisplayHeatmap(start,end,callback) {
	var accum = makeHeatmap(start,end);
	displayHeatmap(accum);	
	document.getElementById("spanHeatmapImageNum").innerHTML = Math.floor((start+end)/2);
	if (typeof callback!="undefined")
		callback();
}

function makeAndDisplayHeatmapSequence(start, end, frameLen) {
	makeAndDisplayHeatmap(start,start+frameLen-1,function() {
		if (start+frameLen<end) {
			setTimeout(makeAndDisplayHeatmapSequence, 20, start+1, end, frameLen);
		}
	});
}

function heatmapTest2() {
	// create and display 10-frame frame-differencing heatmaps for entire movie (frames 0-1500)
	cacheImages(0,1500,function() {
		makeAndDisplayHeatmapSequence(0, 1450, 50);
	});
}

function cacheImages(start, end, callback) {
	numImagesCached = 0;
	cachedImageData = [];
	for (var i=start; i<=end; i++) {
		loadSmartMeetingImage(i, true, function() {
			numImagesCached++;
			if (typeof callback!="undefined" && numImagesCached==end-start+1)
				callback();
		});
	}
}

function loadSmartMeetingImage(imgNum, cacheIt, cachedCallback) {
    var num = "00000"+imgNum;
    num = num.substr(num.length-6);
    var filename = "smartMeetingImages/frame"+num+".png";  
    readImage(canvas,filename,function() {
   		if (cacheIt) {
   			cachedImageData[imgNum] = ctx.getImageData(0, 0, imgWidth, imgHeight);
   			if (typeof cachedCallback!="undefined")
   				cachedCallback();
   		}
    });
}

function makeHeatmap(start,end) { // it's assumed that these frames are in cachedImageData[]
	// initialise 2d accumulator
	var accum = [];
	for (var x=0; x<imgWidth; x++) {
		accum[x] = [];
		for (var y=0; y<imgHeight; y++) {
			accum[x][y] = 0;
		}
	}
	// accumulate differences between subsequent frames
	var imageDataWidth = cachedImageData[start].width;
	for (var i=start; i<end-1; i++) {
		for (var x=0; x<imgWidth; x++) {
			for (var y=0; y<imgHeight; y++) {
				var index = (x + y * imageDataWidth) * 4;
				var diff = Math.abs(cachedImageData[i].data[index] - cachedImageData[i+1].data[index]);
				accum[x][y] += diff;
			}
		}
	}
	return accum;
}

function displayHeatmap(accum) {
	var imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);
	// find max accumulated value (for normalising to range 0-255)
	var max = -1;
	for (var x=0; x<imgWidth; x++) {
		for (var y=0; y<imgHeight; y++) {
			if (accum[x][y]>max)
				max = accum[x][y];
		}
	}
	// put normalised accumulator data in Canvas
	var scale = 255/max;
	scale *= 6;
	for (var x=0; x<imgWidth; x++) {
		for (var y=0; y<imgHeight; y++) {
			var index = (x + y * imageData.width) * 4;
			var val = Math.round(accum[x][y]*scale);
			if (val>255)
				val = 255;
			imageData.data[index] = imageData.data[index+1] = imageData.data[index+2] = val;
		}
	}	
	ctx.putImageData(imageData, 0, 0);
}

function backgroundModelMean(callback) {
	// make a background model image by simple average (mean) of pixels
	cacheImages(0,1500,function() {
		var imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);
		// each output pixel is the sum of all input pixels at that position, divided by 1501
		for (var x=0; x<imgWidth; x++) {
			for (var y=0; y<imgHeight; y++) {
				var sum = 0;
				var index = (x + y * imageData.width) * 4;
				for (var frame=0;frame<=1500;frame++) {
					sum += cachedImageData[frame].data[index];
				}
				sum /= 1501;
				imageData.data[index] = imageData.data[index+1] = imageData.data[index+2] = Math.floor(sum); 
			}
		}			
		ctx.putImageData(imageData, 0, 0);
		if (typeof callback!="undefined")
			callback(imageData);
	});	
}

function backgroundModelStDev() {
	// for each pixel, find the WINDOWSIZE-frame run with lowest standard deviation.. use that for the output value
	// Standard Deviation = square root of variance, where variance is average square deviation from mean
	var WINDOWSIZE = 20;
	backgroundModelMean(function(imageData) {
		// we now have: (i) cached images; (ii) mean pixel values stored in imageData
		for (var x=0; x<imgWidth; x++) {
			for (var y=0; y<imgHeight; y++) {
				var index = (x + y * imageData.width) * 4;
				var bestStDev = 99999999;
				var bestStartFrame = -1;
				for (var startframe=0;startframe<=1500-WINDOWSIZE;startframe++) {
					var sumSqrDev = 0;
					for (var frame=startframe;frame<startframe+WINDOWSIZE;frame++) {
						var diff = cachedImageData[frame].data[index] - imageData.data[index];
						sumSqrDev += (diff*diff);
					}
					var stDev = Math.sqrt(sumSqrDev);
					if (stDev<bestStDev) {
						bestStDev = stDev;
						bestStartFrame = startframe;
					}
				}
				if (bestStartFrame>=0) {
					imageData.data[index] = imageData.data[index+1] = imageData.data[index+2] = cachedImageData[bestStartFrame].data[index];
				}
				else {// error: mark as red pixel
					imageData.data[index] = 255;
					imageData.data[index+1] = imageData.data[index+2] = 0;
				}

			}
		}	
		ctx.putImageData(imageData, 0, 0);	
	});
}

