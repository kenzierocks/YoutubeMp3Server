let $statusText;
let $downloadBox;
let $errorDisplay;
let $progressBox;
let $rotateArrow;
let $progressBar;
let $history;

let activeSse;

function initializeTargets() {
    $statusText = $("#statusText");
    $progressBox = $("#progress-box");
    $downloadBox = $("#download-box");
    $errorDisplay = $("#error-display");
    $rotateArrow = $(".before-arrow, .after-arrow");
    $progressBar = $("#progress-bar");
    $history = $("#conversion-history");
}

function emptyData() {
    [$statusText, $statusText, $errorDisplay, $progressBox].forEach(
        jq => jq.empty()
    );
    $downloadBox.text("");
}

function tearDownSse() {
    if (activeSse !== undefined) {
        activeSse.close();
        activeSse = undefined;
    }
}

const Status = {
    CREATED: 'CREATED',
    CONVERTING: 'CONVERTING',
    SUCCESSFUL: 'SUCCESSFUL',
    FAILED: 'FAILED'
};

function setupSse(id) {
    tearDownSse();
    const source = new EventSource(`/mp3ify/${id}/stream`);
    source.addEventListener("status", e => {
        const status = e.data;
        if (status === Status.FAILED) {
            $statusText.text("Failed!");
            setProgressBar("danger", 100);
            $.get(`/mp3ify/${id}/status`, data => $errorDisplay.text(data.reason));
        } else if (status === Status.SUCCESSFUL) {
            $statusText.text("Conversion complete!");
            onSuccess(id);
        } else if (status == Status.CONVERTING) {
            $statusText.text("Converting...");
        }
    });
    let doCr = false;
    source.addEventListener("outputLine", e => {
        if (doCr) {
            $progressBox.text((i, oldText) => {
                // from 1 before end, as end is a newline as well
                const lastNewline = oldText.lastIndexOf('\n', oldText.length - 2);
                const newText = oldText.substring(0, lastNewline + 1);
                return newText;
            });
            doCr = false;
        }
        $progressBox.append(e.data + '\n');
    });
    source.addEventListener("carrigeReturn", e => {
        doCr = true;
    });
    activeSse = source;
}

function onSuccess(id) {
    rotateArrow(ARROW_LEFT);
    setProgressBar("success", 100);
    $.get(`/mp3ify/${id}/fileName`, fileName => {
        $downloadBox['html'](`<a href="/mp3ify/${id}/download">Download ${fileName}!</a>`);
    });
}

const colors = ["info", "warning", "success", "danger"];

function setProgressBar(color, percent) {
    const e = $progressBar;
    colors.forEach(c => e.removeClass(`bg-${c}`));
    e.addClass(`bg-${color}`);
    e.css('width', percent + "%");
    e.attr('aria-valuenow', percent);
}

let arrowRotation = 0;
let arrowPromise = undefined;

const ARROW_LEFT = 0;
const ARROW_RIGHT = 1;

function rotateArrow(side = undefined) {
    if (arrowPromise !== undefined) {
        arrowPromise = arrowPromise.then(() => rotateArrow(side));
        return;
    }
    const isCurrentlyRight = arrowRotation % 360 === 0;
    if (side === ARROW_LEFT) {
        if (isCurrentlyRight) {
            arrowRotation += 180;
        }
    } else if (side === ARROW_RIGHT) {
        if (!isCurrentlyRight) {
            arrowRotation += 180;
        }
    } else {
        arrowRotation += 180;
    }
    arrowPromise = new Promise(resolve => $rotateArrow.velocity({
        rotateZ: arrowRotation + "deg"
    }, {
        complete: resolve
    }));
    arrowPromise.then(() => arrowPromise = undefined);
}

function getHistory() {
	$.get('/mp3ify').then(convs => {
		$history['html'](convs.map(c => `<li><a href="/mp3ify/${c.id}/download">Download ${c.name}!</a></li>`).join('\n'));
	});
}

$(() => {
    initializeTargets();
    getHistory();
    const $videoForm = $("#video-form");
    $videoForm.submit(e => {
        e.preventDefault();

        rotateArrow(ARROW_RIGHT);

        const video = $("#video").val();

        emptyData();
        setProgressBar("info", 50);
        $['post']({
            url: '/mp3ify',
            data: JSON.stringify({'video': video})
        })['done'](id => {
            console.log(`Converting ${video}, job ID = ${id}`);
            $statusText.text(`Converting...`);
            setupSse(id);
        })['fail']((jqXHR, textStatus, error) => {
            setProgressBar("danger", 100);
            $errorDisplay.text(`Error: ${error}`)
        })
    });
});
