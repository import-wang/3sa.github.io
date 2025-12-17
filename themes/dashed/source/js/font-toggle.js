(function () {
    var dateTimeEl = document.getElementById("navDateTime");

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function renderDateTime() {
        if (!dateTimeEl) return;
        var d = new Date();
        dateTimeEl.textContent =
            d.getFullYear() +
            "-" +
            pad2(d.getMonth() + 1) +
            "-" +
            pad2(d.getDate()) +
            " " +
            pad2(d.getHours()) +
            ":" +
            pad2(d.getMinutes()) +
            ":" +
            pad2(d.getSeconds());
    }

    renderDateTime();
    setInterval(renderDateTime, 1000);

})();
