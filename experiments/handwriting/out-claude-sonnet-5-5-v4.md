Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
## Example
n = 4

(Grid drawn with columns labelled 1 2 3 4 across the top and "Column" to the right, and rows labelled 1 2 3 4 down the left with "Row" beside them. Red stars are in the cells where column ≤ row, and the diagonal cells are circled in green.)

| Row \ Col | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 1 | * | | | |
| 2 | * | * | | |
| 3 | * | * | * | |
| 4 | * | * | * | * |

## Known
Row & Colum start @ Value=1

## Ans/Solution

```c
int main() {
    int n = 4;
    for(int i=1; i<=n; i++){
        for(int j=1; j<=n; j++){
            if (j<=i){
                printf("*");
            }
            else {
                break;
            }
        }
        printf("\n");
    }
}
return 0;
```

## Observation
1. Right angle triangle
2. Print * only if column value is less than or equal to Row Value

## TRACE TABLE

| Row (i) | Column (j) | Condition (j<=i) | Output |
|---|---|---|---|
| 1 | 1 | 1<=1 | * |
| | 2 | 2<=1 | – |
| 2 | 1 | 1<=2 | * |
| | 2 | 2<=2 | ** |
| | 3 | 3<=2 | – |
| 3 | 1 | 1<=3 | * |
| | 2 | 1<=3 | ** |
| | 3 | 3<=3 | *** |

## Assumption
1) Outer loop = Row
2) Inner loop = Column

## Example
n=4

```
1
12
123
1234
```

## Example
n=4

```
1
22
333
4444
```
