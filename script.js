const SHEET_ID = '1ozsuYJgB-Xe9t8K-QLDIoD6jwu9K3E8hioqYEf7TkMs';
const SHEET_NAME = 'Лидерборд';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzrHAYNxyuW5r19IkGPLJPQqluHRYxFfOj1JikFIAfRS_DMMnQ0rEKMk9RcLbKzy1fj/exec';
const ANSWER_LETTERS = ['а', 'б', 'в', 'г', 'д', 'е'];

let allQuestions = null;
let quizQuestions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let userName = '';
let userGroup = '';

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

async function loadQuestions() {
    const response = await fetch('questions.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    allQuestions = await response.json();
}

function getAllQuestions() {
    return [...allQuestions.algebra, ...allQuestions.geometry, ...allQuestions.trigonometry];
}

function getSelectedQuestions() {
    if (!allQuestions) return [];

    const allChecked = document.getElementById('All').checked;
    const algebraChecked = document.getElementById('Algebra').checked;
    const geometryChecked = document.getElementById('Geometry').checked;
    const trigonometryChecked = document.getElementById('Trigonometry').checked;

    const anyThemeChecked = algebraChecked || geometryChecked || trigonometryChecked;
    if (allChecked || !anyThemeChecked) {
        return getAllQuestions();
    }

    const result = [];
    if (algebraChecked) result.push(...allQuestions.algebra);
    if (geometryChecked) result.push(...allQuestions.geometry);
    if (trigonometryChecked) result.push(...allQuestions.trigonometry);
    return result;
}

function updateQuestionCount() {
    const count = getSelectedQuestions().length;
    document.getElementById('question-count').textContent = 'Вопросов: ' + count;
}

function startTest() {
    userName = document.getElementById('name-input').value.trim();
    userGroup = document.getElementById('group-input').value.trim();

    if (!userName) {
        alert('Пожалуйста, введите фамилию и имя.');
        return;
    }

    quizQuestions = getSelectedQuestions();
    currentQuestionIndex = 0;
    userScore = 0;

    showPage('test');
    renderQuestion();
}

function renderQuestion() {
    const question = quizQuestions[currentQuestionIndex];

    document.getElementById('question-number').textContent =
        'Вопрос ' + (currentQuestionIndex + 1) + ' из ' + quizQuestions.length;
    document.getElementById('question-text').textContent = question.question;

    const container = document.getElementById('answers-container');
    container.innerHTML = '';

    question.answers.forEach((answer, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'checkbox-button-container';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'btn-check-input answer-input';
        input.value = answer;
        input.id = 'answer-' + Math.random().toString(36).slice(2);

        const label = document.createElement('label');
        label.className = 'btn-check-label';
        label.htmlFor = input.id;
        label.textContent = ANSWER_LETTERS[index] + ') ' + answer;

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
    });

    container.querySelectorAll('.answer-input').forEach(input => {
        input.addEventListener('change', () => {
            if (input.checked) {
                container.querySelectorAll('.answer-input').forEach(other => {
                    if (other !== input) other.checked = false;
                });
            }
        });
    });

    const nextButton = document.getElementById('next-button');
    const isLast = currentQuestionIndex === quizQuestions.length - 1;
    nextButton.textContent = isLast ? 'Показать результат' : 'Следующий вопрос';
}

function nextQuestion() {
    const selected = document.querySelector('#answers-container .answer-input:checked');
    if (!selected) {
        alert('Выберите вариант ответа.');
        return;
    }

    const question = quizQuestions[currentQuestionIndex];
    if (selected.value === question.correctAnswer) {
        userScore++;
    }

    currentQuestionIndex++;
    if (currentQuestionIndex < quizQuestions.length) {
        renderQuestion();
    } else {
        finishTest();
    }
}

function finishTest() {
    const total = quizQuestions.length;
    const percent = total > 0 ? Math.round(userScore / total * 100) : 0;

    document.getElementById('result-text').textContent =
        'Ваш результат: ' + userScore + ' из ' + total + ' (' + percent + '%)';

    saveResultToSheet({
        name: userName,
        group: userGroup || '—',
        score: userScore,
        total: total,
        percent: percent
    });
    showPage('results');
}

function getSheetCsvUrl() {
    return 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
        '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(SHEET_NAME);
}

async function saveResultToSheet(entry) {
    if (!APPS_SCRIPT_URL) {
        alert('Результат не сохранён в таблицу: укажите APPS_SCRIPT_URL в script.js.');
        return;
    }
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(entry)
        });
    } catch (error) {
        alert('Не удалось отправить результат в таблицу.');
    }
}

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (ch !== '\r') {
            field += ch;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

async function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');

    if (!SHEET_ID) {
        tbody.innerHTML = '<tr><td colspan="5">Таблица лидеров не настроена. Укажите SHEET_ID в script.js.</td></tr>';
        return;
    }

    try {
        const response = await fetch(getSheetCsvUrl());
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const rows = parseCSV(await response.text());

        const entries = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (r.length < 5 || r.every(cell => cell.trim() === '')) continue;
            entries.push({
                name: r[0],
                group: r[1],
                score: Number(r[2]),
                total: Number(r[3]),
                percent: Number(r[4]),
                date: r[5] || ''
            });
        }
        entries.sort((a, b) => b.percent - a.percent || b.score - a.score);

        tbody.innerHTML = '';
        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Пока нет результатов. Пройдите тест первым!</td></tr>';
            return;
        }

        entries.forEach((entry, index) => {
            const row = document.createElement('tr');

            const placeCell = document.createElement('td');
            placeCell.textContent = index + 1;
            row.appendChild(placeCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = entry.name;
            row.appendChild(nameCell);

            const groupCell = document.createElement('td');
            groupCell.textContent = entry.group;
            row.appendChild(groupCell);

            const resultCell = document.createElement('td');
            resultCell.textContent = entry.score + ' из ' + entry.total + ' (' + entry.percent + '%)';
            row.appendChild(resultCell);

            const dateCell = document.createElement('td');
            dateCell.textContent = entry.date;
            row.appendChild(dateCell);

            tbody.appendChild(row);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5">Не удалось загрузить таблицу лидеров. Проверьте доступ к таблице.</td></tr>';
    }
}

function init() {
    document.getElementById('start-button').addEventListener('click', startTest);
    document.getElementById('next-button').addEventListener('click', nextQuestion);
    document.getElementById('retry-button').addEventListener('click', () => showPage('registration'));
    document.getElementById('back-to-start').addEventListener('click', () => showPage('registration'));

    document.getElementById('show-leaderboard-from-registration').addEventListener('click', () => {
        showPage('leaderboard');
        renderLeaderboard();
    });
    document.getElementById('show-leaderboard-from-results').addEventListener('click', () => {
        showPage('leaderboard');
        renderLeaderboard();
    });

    document.getElementById('All').addEventListener('change', event => {
        document.querySelectorAll('.theme-checkbox').forEach(cb => cb.checked = event.target.checked);
        updateQuestionCount();
    });
    document.querySelectorAll('.theme-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            document.getElementById('All').checked = false;
            updateQuestionCount();
        });
    });

    loadQuestions()
        .then(updateQuestionCount)
        .catch(() => alert('Не удалось загрузить вопросы. Откройте страницу через локальный сервер.'));
}

document.addEventListener('DOMContentLoaded', init);
