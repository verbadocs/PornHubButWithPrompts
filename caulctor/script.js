let display = document.getElementById('result');
let currentInput = '';
let operator = '';
let previousInput = '';

function appendToDisplay(value) {
    if (value === '+' || value === '-' || value === '*' || value === '/') {
        if (currentInput === '') return;
        if (previousInput !== '' && operator !== '') {
            calculate();
        }
        operator = value;
        previousInput = currentInput;
        currentInput = '';
        display.value = previousInput + ' ' + operator + ' ';
    } else {
        currentInput += value;
        if (operator === '') {
            display.value = currentInput;
        } else {
            display.value = previousInput + ' ' + operator + ' ' + currentInput;
        }
    }
}

function calculate() {
    if (previousInput === '' || currentInput === '' || operator === '') return;
    
    let result;
    const prev = parseFloat(previousInput);
    const current = parseFloat(currentInput);
    
    switch (operator) {
        case '+':
            result = prev + current;
            break;
        case '-':
            result = prev - current;
            break;
        case '*':
            result = prev * current;
            break;
        case '/':
            if (current === 0) {
                alert('Cannot divide by zero');
                return;
            }
            result = prev / current;
            break;
        default:
            return;
    }
    
    display.value = result;
    currentInput = result.toString();
    previousInput = '';
    operator = '';
}

function clearDisplay() {
    display.value = '';
    currentInput = '';
    previousInput = '';
    operator = '';
}

function deleteLast() {
    if (operator !== '' && currentInput === '') {
        operator = '';
        currentInput = previousInput;
        previousInput = '';
        display.value = currentInput;
    } else if (currentInput !== '') {
        currentInput = currentInput.slice(0, -1);
        if (operator === '') {
            display.value = currentInput;
        } else {
            display.value = previousInput + ' ' + operator + ' ' + currentInput;
        }
    }
}