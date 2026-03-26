// Вземаме бутонa
let button = document.querySelector("button");

// Добавяме действие при клик
button.addEventListener("click", function () {
    
    // Вземаме стойностите от полетата
    let start = document.querySelectorAll("input")[0].value;
    let end = document.querySelectorAll("input")[1].value;

    // Проверка дали са празни
    if (start === "" || end === "") {
        alert("Моля въведи начална и крайна точка!");
        return;
    }

    // Показваме съобщение
    alert("Маршрутът от " + start + " до " + end + " се изчислява...");

    // Променяме еко метъра (примерно)
    let ecoBox = document.querySelector(".box");
    ecoBox.innerHTML = "<p><b>Еко метър:</b> 25%</p><p>По-добър маршрут 🌱</p>";
});
