<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Моя страница с черным фоном</title>
    <style>
        body {
            background-color: black;
            color: white;
        }

        .custom-select {
            position: relative;
            display: inline-block;
        }

        .custom-select select {
            display: none;
        }

        .custom-select .select-selected {
            background-color: #f1f1f1;
            padding: 5px;
        }

        .custom-select .select-items {
            position: absolute;
            background-color: #f1f1f1;
            display: none;
            z-index: 1;
        }

        .custom-select .select-items div {
            padding: 5px;
            cursor: pointer;
        }

        .custom-select .select-selected:after {
            content: "";
            border: 6px solid transparent;
            border-top-color: black;
            position: absolute;
            right: 10px;
            top: 14px;
        }
    </style>
</head>

<body>
    <hr>
    <h1 class="code-line" data-line-start=1 data-line-end=2><a id="WELCOME_TO_SUPER_CLUB_MEMES_1"></a>WELCOME TO SUPER CLUB MEMES</h1>
    <p class="has-line-data" data-line-start="2" data-line-end="3"><img src="http://i.yapx.ru/Tyrz9.gif" alt="Logo club memes"></p>
    <h1 class="code-line" data-line-start=3 data-line-end=4><a id="INFO_TO_CLUB_3"></a>INFO TO CLUB</h1>
    <h1 class="code-line" data-line-start=4 data-line-end=5><a id="hi_fresh_mems_to_mem_onehttpsusagifcomwpcontentuploadsfunnyfaces49gif_i_to_mem_twohttpsusagifcomwpcontentuploadsfriendship60gif_i_to__mem_3httpslifeoruwpcontentuploadsnoviesmeshniegifki47gif_i_to_mem_4httpslifeoruwpcontentuploadsnoviesmeshniegifki21gif_4"></a>hi! fresh mems to <img src="https://usagif.com/wp-content/uploads/funny-faces-49.gif" alt="mem one"> i to <img src="https://usagif.com/wp-content/uploads/friendship-60.gif" alt="mem two">. i to <img src="https://lifeo.ru/wp-content/uploads/novie-smeshnie-gifki-47.gif" alt="mem 3"> i to <img src="https://lifeo.ru/wp-content/uploads/novie-smeshnie-gifki-21.gif" alt="mem 4">.</h1>
    <hr>
    <h1 class="code-line" data-line-start=6 data-line-end=7><a id="MEGA_MEM_httpsyoutubeZfqYReML_5csi0JRmEHo86bsGxU4L_6"></a><a href="https://youtu.be/ZfqYReML_5c?si=0JRmEHo86bsGxU4L">-MEGA MEM -</a></h1>

    <div class="custom-select">
        <select onchange="location = this.value;">
            <option value="">Choose a link</option>
            <option value="https://example.com/page1">Link 1</option>
            <option value="https://example.com/page2">Link 2</option>
            <option value="https://example.com/page3">Link 3</option>
        </select>
        <div class="select-selected">
            Choose a link
        </div>
        <div class="select-items" style="display: none;">
            <div onclick="location.href='https://example.com/page1'">Link 1</div>
            <div onclick="location.href='https://example.com/page2'">Link 2</div>
            <div onclick="location.href='https://example.com/page3'">Link 3</div>
        </div>
    </div>

    <script>
        var x, i, j, selElmnt, a, b, c;
        x = document.getElementsByClassName("custom-select");
        for (i = 0; i < x.length; i++) {
            selElmnt = x[i].getElementsByTagName("div")[0];
            a = document.createElement("div");
            a.setAttribute("class", "select-items");
            for (j = 1; j < selElmnt.getElementsByTagName("option").length; j++) {
                b = document.createElement("div");
                b.innerHTML = selElmnt.getElementsBy
TagName("option")[j].innerHTML;
                b.addEventListener("click", function(e) {
                    var y, i, k, s, h;
                    s = this.parentNode.parentNode.getElementsByTagName("select")[0];
                    h = this.parentNode.previousSibling;
                    for (i = 0; i < s.length; i++) {
                        if (s.options[i].innerHTML == this.innerHTML) {
                            s.selectedIndex = i;
                            h.innerHTML = this.innerHTML;
                            y = this.parentNode.getElementsByClassName("same-as-selected");
                            for (k = 0; k < y.length; k++) {
                                y[k].removeAttribute("class");
                            }
                            this.setAttribute("class", "same-as-selected");
                            break;
                        }
                    }
                    h.click();
                });
                a.appendChild(b);
            }
            x[i].appendChild(a);
            selElmnt.addEventListener("click", function(e) {
                e.stopPropagation();
                closeAllSelect(this);
                this.nextSibling.style.display = "block";
                this.classList.toggle("select-arrow-active");
            });
        }

        function closeAllSelect(elmnt) {
            var x, y, i, arrNo = [];
            x = document.getElementsByClassName("select-items");
            y = document.getElementsByClassName("select-selected");
            for (i = 0; i < y.length; i++) {
                if (elmnt == y[i]) {
                    arrNo.push(i)
                } else {
                    y[i].classList.remove("select-arrow-active");
                }
            }
            for (i = 0; i < x.length; i++) {
                if (arrNo.indexOf(i)) {
                    x[i].style.display = "none";
                }
            }
        }

        document.addEventListener("click", closeAllSelect);
    </script>

</body>

</html>
