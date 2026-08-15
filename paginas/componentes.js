const buttons = document.querySelectorAll('.info-btn')
const modals = document.querySelectorAll('.modal')
const closeButtons = document.querySelectorAll('.close-button')

buttons.forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = document.getElementById(btn.getAttribute('data-modal'))
        modal.classList.remove('hide')
        modal.classList.add('show')
    })
})

function closeModal(modal) {
    modal.classList.remove('show')
    modal.classList.add('hide')
    setTimeout(() => {
        modal.classList.remove('hide')
    }, 300)
}

closeButtons.forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal')))
})

window.addEventListener('click', (e) => {
    modals.forEach(modal => {
        if (e.target === modal) closeModal(modal)
    })
})