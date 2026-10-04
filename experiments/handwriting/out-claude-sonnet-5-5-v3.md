Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
# Example: n = 4

## Known
Row & Colum start @ Value=1

## Ans/Solution

```
int main() {
    int n= 4;
    for(int i=1; i<=n; i++){
        for(int j=1; j<=n; j++){
            if (j<=i){
                printf("*");
            }
            else {
                } break;
        } }
        printf("\n");
    }
    } Return 0;
```

(Grid sketch: a 4×4 grid with columns labelled 1 2 3 4 across the top and rows labelled 1–4 down the side. Red stars fill each row from column 1 up to the diagonal, and the diagonal stars are circled in green. Arrow labels: "Column" and "Row".)

## Observation
1. Right angle triangle
2. Print * only if column value is less than or equal to Row Value

## TRACE TABLE

| Row (i) | Column (j) | Condition (j<=i) | Output |
|---|---|---|---|
| 1 | 1 | 1<=1 | * — |
| | 2 | 2<=1 | * |
| 2 | 1 | 1<=2 | — / * |
| | 2 | 2<=2 | * — / * |
| | 3 | 3<=2 | * * — / * |
| 3 | 1 | 1<=3 | * * * — / * |
| | 2 | 2<=3 | * * — / * |
| | 3 | 3<=3 | * * — |

The Output column is hard to read. The handwritten star marks and dashes there are only approximated.

## Assumption
1) Outer loop = Row
2) Inner loop = Column

## Example: m=4
```
1
1 2
1 2 3
1 2 3 4
```

## Example: m=4
```
1
2 2
3 3 3
4 4 4 4
```
