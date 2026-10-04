Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
# Example
m = 4

# Known
Row & Colum start @ Value=1

(A 4×4 grid is drawn, with columns labelled 1 2 3 4 across the top and rows labelled 1 2 3 4 down the side, marked "Column" and "Row". Stars are drawn in the lower-left triangle, and the diagonal stars are circled in green.)

# Ans/Solution
```c
int main() {
  int m= 4;
  for(int i=1; i<=m; i++){
      for(int j= 1; j<=m; j++) {
[obscured]
         break;
      }  }
      printf("\n");
   }
} Return 0;
```

# Observation
1. Right angle triangle
2. Print * only if column value is less than or equal to Row Value

# TRACE TABLE

| Row (i) | Column (j) | Condition (j<=i) | Output |
|---|---|---|---|
| 1 | 1 | 1<=1 | * — |
| | 2 | 2<=1 | * |
| 2 | 1 | 1<=2 | — |
| | 2 | 2<=2 | * |
| | 3 | 3<=2 | * — |
| 3 | 1 | 1<=3 | * * — |
| | 2 | 2<=3 | * * — |
| | 3 | 3<=3 | * * — |

The Output column is hard to read, and the stars are not aligned to rows. The values above are my best reading of it.

# Assumption
1) Outer loop = Row
2) Inner loop = Colum

# Example
m=4

```
1
1 2
1 2 3
1 2 3 4
```

# Example
m=4

```
1
2 2
3 3 3
4 4 4 4
```
