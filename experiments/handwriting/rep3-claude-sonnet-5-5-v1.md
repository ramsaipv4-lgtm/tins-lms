# Example
n = 4

# Known
Row & Colum start @ Value=1

(Drawn 4×4 grid, columns labelled 1 2 3 4, rows labelled 1 2 3 4, "Row" and "Colum" labelled. Stars are in the lower-left triangle, including the diagonal. Diagonal cells are circled in green.)

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **1** | * | | | |
| **2** | * | * | | |
| **3** | * | * | * | |
| **4** | * | * | * | * |

# Ans/Solution

```
int main() {
  int n= 4;
  for(int i=1; i<=n; i++){
      for(int j= 1; j<=n; j++){
          if (j<=i){
              printf("*");
          }
          else {
              break;
          }
      }
      printf("\n");
  }
  return 0;
}
```

# Observation
1. Right angle triangle
2. Print * only if column value is less than or equal to Row value

# TRACE TABLE

| Row (i) | Column (j) | Condition (j<=i) | Output |
|---|---|---|---|
| 1 | 1 | 1<=1 | * — |
| | 2 | 2<=1 | * |
| 2 | 1 | 1<=2 | * |
| | 2 | 2<=2 | * |
| | 3 | 3<=2 | * |
| 3 | 1 | 1<=3 | * |
| | 2 | 2<=3 | * |
| | 3 | 3<=3 | * |

(The Output column is hard to read. Only a few stars are legible, along with short dash marks.)

# Assumption
1) Outer loop = Row
2) Inner loop = Colum

# Example
n=4

```
1
12
123
1234
```

# Example
n=4

```
1
22
333
4444
```
