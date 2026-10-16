# Rubik's Sudoku

Given two random, but already solved sudokus, try to transform the first 
with elementary operations into the second one without ever having an invalid sudoku.

## Allowed operations

- Rotate whole sudoku 90 deg. clock- and counter-clockwise
- Flip whole sudoku horizontally / vertically
- Exchange two whole columns within one column of sub-squares
- Exchange two whole rows within one row of sub-squares
- Exchange two columns of sub-squares
- Exchange two rows of sub-squares
- Exchange two numbers within a sub-square that are in the same row or column
  - Automatically resolving resulting conflicts
 
