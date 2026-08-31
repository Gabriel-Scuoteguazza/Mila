const header = document.querySelector(".header");

if (header) {
    const updateHeader = () =>
        header.classList.toggle("is-scrolled", window.scrollY > 12);
    window.addEventListener("scroll", updateHeader, { passive: true });
    updateHeader();
}

document.querySelectorAll(".carousel").forEach((carousel) => {
    let isDragging = false;
    let startX = 0;
    let startScroll = 0;

    carousel.addEventListener("pointerdown", (event) => {
        isDragging = true;
        startX = event.clientX;
        startScroll = carousel.scrollLeft;
        carousel.setPointerCapture(event.pointerId);
        carousel.classList.add("is-dragging");
    });

    carousel.addEventListener("pointermove", (event) => {
        if (isDragging)
            carousel.scrollLeft = startScroll - (event.clientX - startX);
    });

    const stopDragging = () => {
        isDragging = false;
        carousel.classList.remove("is-dragging");
    };

    carousel.addEventListener("pointerup", stopDragging);
    carousel.addEventListener("pointercancel", stopDragging);
});

const themeToggle = document.getElementById("theme-toggle");
const logo = document.querySelector(".logo img");
const themeIcon = themeToggle?.querySelector("img");

const caminhoAssets = window.location.pathname.includes("/paginas/")
    ? "../assets/"
    : "assets/";

function atualizarTema() {
    const modoClaro = document.body.classList.contains("light-mode");

    if (logo) {
        logo.src = modoClaro
            ? caminhoAssets + "logoescura.svg"
            : caminhoAssets + "logo.svg";
    }

    if (themeIcon) {
        themeIcon.src = modoClaro
            ? caminhoAssets + "modoclaro.png"
            : caminhoAssets + "alterarVisual.svg";
    }
}

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");

        localStorage.setItem(
            "theme",
            document.body.classList.contains("light-mode") ? "light" : "dark",
        );

        atualizarTema();
    });
}

if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
}

atualizarTema();

const btnDiferenciais = document.querySelector(".desenvolvimento2 .btn");
const secaoConclusao = document.querySelector(".conclusao");

if (btnDiferenciais && secaoConclusao) {
    btnDiferenciais.addEventListener("click", () => {
        secaoConclusao.scrollIntoView({ behavior: "smooth" });
    });
}

const menuHamburguer = document.querySelector(".menu-hamburguer");
const menuMobile = document.querySelector(".menu-mobile-overlay");
const menuBackdrop = document.querySelector(".menu-backdrop");
const fecharMenu = document.querySelector(".fechar-menu");

function abrirMenu() {
    menuMobile.classList.add("open");
    menuBackdrop.classList.add("open");
}

function fecharMenuMobile() {
    menuMobile.classList.remove("open");
    menuBackdrop.classList.remove("open");
}

menuHamburguer?.addEventListener("click", abrirMenu);
fecharMenu?.addEventListener("click", fecharMenuMobile);
menuBackdrop?.addEventListener("click", fecharMenuMobile);









